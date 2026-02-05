import { generateText, tool } from 'ai';
import { fastModel } from '@/lib/services/ai-provider';
import { z } from 'zod';
import type { TranscriptProcessingResult } from '@/lib/utils/types';
import { getCurrentPSTDateTime } from '@/lib/utils/date-helpers';

const ApprovalDecisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit', 'unrelated']),
  edits: z.array(z.object({
    type: z.enum(['remove_task', 'update_task_description', 'update_deadline', 'change_project', 'add_task']),
    taskIndex: z.number().optional().describe('0-based index of the task to modify'),
    newValue: z.string().optional().describe('The new value for the field being changed'),
  })).optional().default([]),
  reasoning: z.string().describe('Brief explanation of why this decision was made'),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

/**
 * Interprets Patrick's natural language response to determine if he's approving,
 * rejecting, requesting edits, or saying something unrelated to the pending approval.
 */
export async function interpretApprovalResponse(
  userMessage: string,
  pendingResult: TranscriptProcessingResult
): Promise<ApprovalDecision> {
  const tasksSummary = pendingResult.tasks.length > 0
    ? pendingResult.tasks.map((t, i) => `${i + 1}. "${t.description}" (project: ${t.project_name || 'none'}, deadline: ${t.deadline || 'none'})`).join('\n')
    : 'No tasks extracted';

  const knowledgeSummary = pendingResult.knowledge.length > 0
    ? `${pendingResult.knowledge.length} knowledge items about: ${pendingResult.knowledge.map(k => k.project_name || 'general').join(', ')}`
    : 'No knowledge items';

  const projectsSummary = pendingResult.new_projects.length > 0
    ? `New projects: ${pendingResult.new_projects.map(p => p.name).join(', ')}`
    : 'No new projects';

  try {
    const { toolCalls } = await generateText({
      model: fastModel,
      tools: {
        decideApproval: tool({
          description: 'Interpret the user response and decide what to do with the pending transcript',
          inputSchema: ApprovalDecisionSchema,
        }),
      },
      toolChoice: { type: 'tool', toolName: 'decideApproval' },
      system: `You are interpreting Patrick's response to a pending voice transcript that needs approval before saving to the database.

Current date and time: ${getCurrentPSTDateTime()}

PENDING DATA SUMMARY:
- Tasks: ${pendingResult.tasks.length} tasks
- Knowledge: ${pendingResult.knowledge.length} items
- New Projects: ${pendingResult.new_projects.length}

INTERPRETATION RULES:
- "looks good", "save it", "yes", "perfect", "that's right", "good", "yep", "correct", "all good", "sounds right" → action: "approve"
- "no", "discard", "cancel", "don't save", "wrong", "delete it", "nevermind", "scratch that" → action: "reject"
- Any specific corrections like "change X to Y", "remove the third task", "that deadline should be Friday", "wrong project" → action: "edit" with edits array
- If the message seems COMPLETELY UNRELATED to approving/rejecting the transcript (like a new question or request), → action: "unrelated"

BE GENEROUS: If it sounds like approval, treat it as approval. Patrick is busy and might just say "yep" or "k".

When editing:
- taskIndex is 0-based (first task = 0)
- For remove_task: just set taskIndex, no newValue needed
- For update_task_description: set taskIndex and newValue with new description
- For update_deadline: set taskIndex and newValue with new deadline string
- For change_project: set taskIndex and newValue with project name
- For add_task: set newValue with the task description`,
      prompt: `Patrick said: "${userMessage}"

Current pending tasks:
${tasksSummary}

${knowledgeSummary}
${projectsSummary}

What should we do?`,
    });

    const toolCall = toolCalls[0];
    if (!toolCall || toolCall.dynamic) {
      // Default to unrelated if we couldn't parse
      return {
        action: 'unrelated',
        edits: [],
        reasoning: 'Could not interpret response',
      };
    }

    return toolCall.input as ApprovalDecision;
  } catch (error) {
    console.error('Error interpreting approval response:', error);
    // If there's an error, treat as unrelated to avoid accidental commits
    return {
      action: 'unrelated',
      edits: [],
      reasoning: 'Error during interpretation',
    };
  }
}

/**
 * Applies edits to a processing result based on the approval decision.
 */
export function applyEdits(
  result: TranscriptProcessingResult,
  edits: ApprovalDecision['edits']
): TranscriptProcessingResult {
  if (!edits || edits.length === 0) return result;

  // Clone the result to avoid mutation
  const updated: TranscriptProcessingResult = {
    tasks: [...result.tasks],
    knowledge: [...result.knowledge],
    new_projects: [...result.new_projects],
  };

  // Process edits in reverse order to maintain correct indices when removing
  const sortedEdits = [...edits].sort((a, b) => (b.taskIndex || 0) - (a.taskIndex || 0));

  for (const edit of sortedEdits) {
    switch (edit.type) {
      case 'remove_task':
        if (edit.taskIndex !== undefined && edit.taskIndex < updated.tasks.length) {
          updated.tasks.splice(edit.taskIndex, 1);
        }
        break;

      case 'update_task_description':
        if (edit.taskIndex !== undefined && edit.taskIndex < updated.tasks.length && edit.newValue) {
          updated.tasks[edit.taskIndex] = {
            ...updated.tasks[edit.taskIndex],
            description: edit.newValue,
          };
        }
        break;

      case 'update_deadline':
        if (edit.taskIndex !== undefined && edit.taskIndex < updated.tasks.length) {
          updated.tasks[edit.taskIndex] = {
            ...updated.tasks[edit.taskIndex],
            deadline: edit.newValue || null,
          };
        }
        break;

      case 'change_project':
        if (edit.taskIndex !== undefined && edit.taskIndex < updated.tasks.length) {
          updated.tasks[edit.taskIndex] = {
            ...updated.tasks[edit.taskIndex],
            project_name: edit.newValue || null,
          };
        }
        break;

      case 'add_task':
        if (edit.newValue) {
          updated.tasks.push({
            description: edit.newValue,
            project_name: null,
            deadline: null,
            priority: null,
          });
        }
        break;
    }
  }

  return updated;
}
