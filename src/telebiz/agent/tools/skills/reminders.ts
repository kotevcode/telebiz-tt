import { getActions, getGlobal } from '../../../../global';

import type { Reminder } from '../../../services/types';
import type { ExtraTool, ToolDefinition, ToolResult } from '../../types';

import { selectChat } from '../../../../global/selectors';
import { selectCurrentTelebizOrganization } from '../../../global/selectors';
import { telebizApiClient } from '../../../services';

// Reminders Tool Definitions
const listReminders: ToolDefinition = {
  type: 'function',
  function: {
    name: 'listReminders',
    description: [
      'Get all active reminders.',
      'Returns reminders with their scheduled times and associated chats.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Optional: filter reminders for a specific chat',
        },
      },
    },
  },
};

const createReminder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createReminder',
    description: [
      'Create a new reminder for a chat.',
      'The reminder will trigger a notification at the specified time.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID to create the reminder for',
        },
        description: {
          type: 'string',
          description: 'What to be reminded about',
        },
        remindAt: {
          type: 'string',
          description: 'When to trigger the reminder (ISO date string or relative like "in 1 hour", "tomorrow 9am")',
        },
        messageId: {
          type: 'string',
          description: 'Optional: specific message ID to link to',
        },
      },
      required: ['chatId', 'description', 'remindAt'],
    },
  },
};

const completeReminder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'completeReminder',
    description: 'Mark a reminder as completed/done.',
    parameters: {
      type: 'object',
      properties: {
        reminderId: {
          type: 'number',
          description: 'The reminder ID to complete',
        },
      },
      required: ['reminderId'],
    },
  },
};

const deleteReminder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'deleteReminder',
    description: 'Delete/cancel a reminder.',
    parameters: {
      type: 'object',
      properties: {
        reminderId: {
          type: 'number',
          description: 'The reminder ID to delete',
        },
      },
      required: ['reminderId'],
    },
  },
};

const updateReminder: ToolDefinition = {
  type: 'function',
  function: {
    name: 'updateReminder',
    description: 'Update a reminder (change time or description).',
    parameters: {
      type: 'object',
      properties: {
        reminderId: {
          type: 'number',
          description: 'The reminder ID to update',
        },
        description: {
          type: 'string',
          description: 'New description (optional)',
        },
        remindAt: {
          type: 'string',
          description: 'New reminder time (ISO date string, optional)',
        },
      },
      required: ['reminderId'],
    },
  },
};

// Reminders Extra Tool Definition
export const REMINDERS_EXTRA_TOOL: ExtraTool = {
  name: 'reminders',
  description: 'Reminder management - create, complete, update, and delete reminders',
  tools: [
    listReminders,
    createReminder,
    completeReminder,
    deleteReminder,
    updateReminder,
  ],
  readOnlyTools: ['listReminders'],
  contextPrompt: `REMINDERS SKILL LOADED. You can now:
- List all reminders with listReminders
- Create new reminders with createReminder
- Mark reminders done with completeReminder
- Delete reminders with deleteReminder
- Update reminder time/description with updateReminder

Reminders are linked to chats and optionally to specific messages.
Use relative times like "in 1 hour", "tomorrow at 9am" for remindAt.`,
};

// Reminders Tool Executors
export async function executeRemindersTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'listReminders':
      return executeListReminders(args.chatId as string | undefined);
    case 'createReminder':
      return executeCreateReminder(args);
    case 'completeReminder':
      return executeCompleteReminder(args.reminderId as number);
    case 'deleteReminder':
      return executeDeleteReminder(args.reminderId as number);
    case 'updateReminder':
      return executeUpdateReminder(args);
    default:
      return { success: false, error: `Unknown reminders tool: ${toolName}` };
  }
}

function executeListReminders(chatId?: string): ToolResult {
  const global = getGlobal();
  const remindersState = global.telebiz?.reminders;

  // Check if reminders are loading
  if (remindersState?.isLoading) {
    return {
      success: true,
      data: {
        reminders: [],
        count: 0,
        note: 'Reminders are still loading. Try again in a moment.',
      },
    };
  }

  // Check for error state
  if (remindersState?.error) {
    return {
      success: false,
      error: `Failed to load reminders: ${remindersState.error}`,
    };
  }

  const reminders = remindersState?.reminders || [];

  let filtered = reminders;
  if (chatId) {
    filtered = reminders.filter((r) => r.chat_id === chatId);
  }

  return {
    success: true,
    data: {
      reminders: filtered.map((r) => summarizeReminder(r, global)),
      count: filtered.length,
    },
  };
}

async function executeCreateReminder(args: Record<string, unknown>): Promise<ToolResult> {
  const { loadTelebizReminders } = getActions();

  const remindAt = parseRemindAt(args.remindAt as string);
  if (!remindAt) {
    return { success: false, error: `Could not parse reminder time: ${args.remindAt}` };
  }

  const global = getGlobal();
  const organizationId = selectCurrentTelebizOrganization(global)?.id;

  try {
    const reminder = await telebizApiClient.reminders.createReminder({
      chat_id: args.chatId as string,
      message_id: args.messageId as string | undefined,
      description: args.description as string,
      remind_at: remindAt.toISOString(),
      organization_id: organizationId,
    });

    // Refresh reminders list to update state
    loadTelebizReminders({});

    return {
      success: true,
      data: {
        created: true,
        reminderId: reminder.id,
        chatId: args.chatId,
        description: args.description,
        remindAt: remindAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function executeCompleteReminder(reminderId: number): Promise<ToolResult> {
  const { loadTelebizReminders } = getActions();

  try {
    await telebizApiClient.reminders.completeReminder(reminderId);

    // Refresh reminders list to update state
    loadTelebizReminders({});

    return {
      success: true,
      data: { completed: true, reminderId },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to complete reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function executeDeleteReminder(reminderId: number): Promise<ToolResult> {
  const { loadTelebizReminders } = getActions();

  try {
    await telebizApiClient.reminders.deleteReminder(reminderId);

    // Refresh reminders list to update state
    loadTelebizReminders({});

    return {
      success: true,
      data: { deleted: true, reminderId },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function executeUpdateReminder(args: Record<string, unknown>): Promise<ToolResult> {
  const { loadTelebizReminders } = getActions();

  const updateData: Record<string, unknown> = {};
  if (args.description) {
    updateData.description = args.description;
  }
  if (args.remindAt) {
    const remindAt = parseRemindAt(args.remindAt as string);
    if (!remindAt) {
      return { success: false, error: `Could not parse reminder time: ${args.remindAt}` };
    }
    updateData.remind_at = remindAt.toISOString();
  }

  try {
    await telebizApiClient.reminders.updateReminder(
      args.reminderId as number,
      updateData,
    );

    // Refresh reminders list to update state
    loadTelebizReminders({});

    return {
      success: true,
      data: { updated: true, reminderId: args.reminderId, ...updateData },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Helper to summarize a reminder for LLM
function summarizeReminder(
  reminder: Reminder,
  global: ReturnType<typeof getGlobal>,
): Record<string, unknown> {
  const chat = selectChat(global, reminder.chat_id);

  return {
    id: reminder.id,
    chatId: reminder.chat_id,
    chatTitle: chat?.title || 'Unknown Chat',
    description: reminder.description,
    remindAt: reminder.remind_at,
    status: reminder.status,
    snoozedCount: reminder.snoozed_count,
  };
}

// Parse relative or absolute time strings
function parseRemindAt(input: string): Date | undefined {
  // Try ISO format first
  const isoDate = new Date(input);
  if (!Number.isNaN(isoDate.getTime()) && input.includes('-')) {
    return isoDate;
  }

  const now = new Date();
  const lower = input.toLowerCase().trim();

  // Relative time patterns
  const inMatch = lower.match(/^in\s+(\d+)\s+(minute|hour|day|week)s?$/);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const ms = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    }[unit] || 0;
    return new Date(now.getTime() + amount * ms);
  }

  // Tomorrow patterns
  if (lower.startsWith('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3];

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0); // Default to 9am
    }
    return tomorrow;
  }

  // Today at time
  const todayMatch = lower.match(/^(?:today\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (todayMatch) {
    const today = new Date(now);
    let hours = parseInt(todayMatch[1], 10);
    const minutes = todayMatch[2] ? parseInt(todayMatch[2], 10) : 0;
    const ampm = todayMatch[3];

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    today.setHours(hours, minutes, 0, 0);
    return today;
  }

  return undefined;
}
