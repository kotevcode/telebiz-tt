# Telebiz Development Guide

This guide covers Telebiz-specific patterns and conventions. For general Telegram Web patterns, see `/CLAUDE.md` at repository root.

## Telebiz Architecture

Telebiz is a modular business extension for Telegram Web that adds:
- AI Agent (Claude, GPT, Gemini integration)
- CRM Integration (HubSpot contacts, companies, deals)
- Bulk Messaging
- Templates & Smart Reminders
- Multi-Organization Management

### Directory Structure

```
src/telebiz/
├── agent/              # AI agent system
│   ├── mcp/           # Model Context Protocol bridge
│   ├── services/      # Agent runners, auth
│   ├── tools/         # Agent tool registry & executor
│   └── types.ts       # Agent type definitions
├── components/         # UI components
│   ├── common/        # Shared Telebiz components
│   ├── left/          # Left panel (settings, integrations)
│   ├── middle/        # Middle panel features
│   ├── right/         # Right panel (agent, CRM, bulk send)
│   ├── modals/        # Telebiz modals
│   └── landing/       # Landing page components
├── config/            # Configuration
├── global/            # State management
│   ├── actions/       # Action handlers
│   ├── reducers/      # State reducers
│   ├── selectors/     # State selectors
│   └── types/         # State type definitions
├── hooks/             # Custom hooks
├── lang/              # Localization
│   ├── translations/  # Language files (en.ts, es.ts)
│   └── telebizLangPack.ts  # Type definitions
├── services/          # API clients & services
│   └── api/           # API client classes
├── styles/            # Shared styles
│   └── _animations.scss  # Animation utilities
└── util/              # Utilities
```

---

## Telebiz Rules

### 1. Code Isolation

**Telebiz code stays in `src/telebiz/`**

- Do NOT mix Telebiz logic into base Telegram files
- Integration points: Import from `src/telebiz/` into base
- Example: `MiddleColumn.tsx` imports `TelebizLanding` component

**When to modify base files:**
- Minimal integration points only (e.g., rendering Telebiz components)
- Never copy Telebiz logic into base app

---

### 2. Localization

**Use `useTelebizLang()` hook:**

```tsx
import { useTelebizLang } from '../../hooks/useTelebizLang';

const Component = () => {
  const lang = useTelebizLang();
  return <div>{lang('TelebizFeature.Title')}</div>;
};
```

**Language files:**
- `src/telebiz/lang/translations/en.ts` - English translations
- `src/telebiz/lang/translations/es.ts` - Spanish translations
- `src/telebiz/lang/telebizLangPack.ts` - TypeScript types

**Key naming:**
- Dot notation: `'TelebizFeature.Subkey'`
- PascalCase for segments: `'TelebizAgent.Chat.Title'`

---

### 3. Styling

**Telebiz Design System:**

```scss
// Telebiz color palette
--color-telebiz-green: #4BB841
--color-telebiz-yellow: #EEBD34
--color-telebiz-orange: #F2862D
--color-telebiz-red: #D44326
--color-telebiz-blue: #3685FB
// ... see src/telebiz/styles/telebiz.scss
```

**Before creating styles:**
1. Check base UI components: `src/components/ui/`
2. Check Telebiz components: `src/telebiz/components/common/`
3. Use base Button, ListItem, Modal, etc. when possible
4. Only create custom SCSS for truly unique Telebiz layouts

**Reuse base components:**
```tsx
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
// NOT: Custom Telebiz button with hover effects
```

---

### 4. State Management

**Telebiz state is nested:**

```tsx
// Access
const agentState = global.telebiz?.agent;
const authState = global.telebiz?.auth;

// Update
global = updateTelebizAgentState(global, { isRunning: true });
```

**Selectors:**
```tsx
// src/telebiz/global/selectors/
export function selectTelebizAuth(global: GlobalState) {
  return global.telebiz?.auth;  // Optional chaining
}
```

**Actions:**
```tsx
// src/telebiz/global/actions/
addActionHandler('telebizActionName', async (global, actions, payload) => {
  // Telebiz-specific logic
});
```

**Always check Telebiz exists:**
- Telebiz may not be initialized
- Use optional chaining: `global.telebiz?.feature`

---

### 5. API Clients

**Extend BaseApiClient:**

```tsx
import { BaseApiClient } from '../BaseApiClient';

class MyApiClientClass extends BaseApiClient {
  async fetchData() {
    const response = await this.request<ResponseType>('/endpoint');

    if (response.status !== 'success') {
      throw new Error('Request failed');
    }

    return response.data;
  }
}

export const MyApiClient = new MyApiClientClass();
```

**Benefits:**
- Automatic auth header injection
- Consistent error handling
- Request/response logging

---

### 6. AI Agent System

**Tool implementation:**

```tsx
// src/telebiz/agent/tools/skills/myTool.ts
import type { ToolDefinition, ToolResult } from '../../types';

export const myTool: ToolDefinition = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter description' },
    },
    required: ['param'],
  },
  handler: async (args, context) => {
    // Tool logic

    return {
      success: true,
      data: result,
      affectedChatIds: ['123'],  // For UI updates
    };
  },
};
```

**Tool registration:**
```tsx
// src/telebiz/agent/tools/registry.ts
import { myTool } from './skills/myTool';

export const toolRegistry = [
  // ... existing tools
  myTool,
];
```

**Confirmation for destructive ops:**
```tsx
if (requiresConfirmation(toolName)) {
  global = updateTelebizAgentState(global, {
    pendingConfirmation: {
      id: generateId(),
      toolName,
      description: 'What will happen',
      args,
      createdAt: Date.now(),
    },
  });
  setGlobal(global);
  return;  // Don't execute yet
}
```

---

### 7. CRM Integration

**Linking chats to entities:**

```tsx
// Link chat to HubSpot contact
actions.linkChatToEntity({
  chatId,
  provider: 'hubspot',
  entityType: 'contact',
  entityId: '12345',
});

// Fetch entity data
const entity = await HubSpotApiClient.getContact('12345');
```

**Displaying relationships:**
- Right panel: `TelebizRelationship` component
- Shows linked contact/company/deal
- Inline actions: update, unlink

---

## Component Patterns

### Telebiz Component Structure

```tsx
import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import { useTelebizLang } from '../../hooks/useTelebizLang';

import Button from '../../../components/ui/Button';

import styles from './ComponentName.module.scss';

type OwnProps = {
  id: string;
};

type StateProps = {
  telebizData?: TelebizData;
};

const ComponentName = ({ id, telebizData }: OwnProps & StateProps) => {
  const lang = useTelebizLang();

  if (!telebizData) return null;

  return (
    <div className={styles.root}>
      <h2>{lang('Telebiz.Title')}</h2>
      <Button color="primary">{lang('Telebiz.Action')}</Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { id }): Complete<StateProps> => {
  return {
    telebizData: selectTelebizData(global, id),
  };
})(ComponentName));
```

---

## Testing

**Telebiz tests:**
- Location: `tests/telebiz/`
- Mirror source structure

**Mock API clients:**
```tsx
jest.mock('../../services/api/MyApiClient', () => ({
  MyApiClient: {
    fetchData: jest.fn(),
  },
}));
```

---

## Common Pitfalls

### ❌ Don't: Mix Telebiz into base files
```tsx
// src/components/middle/SomeComponent.tsx
if (global.telebiz?.feature) {
  // Telebiz logic here ❌
}
```

### ✅ Do: Import Telebiz components
```tsx
// src/components/middle/SomeComponent.tsx
import TelebizFeature from '../../telebiz/components/TelebizFeature';

{shouldShowTelebiz && <TelebizFeature />}
```

---

### ❌ Don't: Create custom button styles
```scss
.myButton {
  background: var(--color-primary);
  &:hover { opacity: 0.8; }  // ❌ Button has this
}
```

### ✅ Do: Use Button component
```tsx
<Button color="primary" onClick={handleClick}>
  {lang('Telebiz.Action')}
</Button>
```

---

### ❌ Don't: Use `useLang()` in Telebiz components
```tsx
const lang = useLang();  // ❌ Won't find Telebiz keys
```

### ✅ Do: Use `useTelebizLang()`
```tsx
const lang = useTelebizLang();  // ✓ Telebiz translations
```

---

## Using Skills

**Telebiz development benefits greatly from skills:**

### Telebiz-Specific Skills:
- `/telebiz-feature FeatureName` - Generate complete feature (state + API + UI)
- `/telebiz-ai-agent` - AI agent patterns
- `/telebiz-crm` - CRM integration patterns
- `/telebiz-architecture` - Feature architecture overview

### General Skills (use these too):
- `/component` - Create components (checks base UI components first!)
- `/lang-key` - Add Telebiz translations
- `/review` - Review code patterns

### Typical Telebiz Task Flow:
```bash
# 1. Create complete feature
/telebiz-feature Analytics

# 2. Add translations
/lang-key

# 3. Review implementation
/review src/telebiz/components/Analytics
```

**See `.claude/skills/SKILL-SELECTION-GUIDE.md` for complete guide.**

---

## Resources

- Main guide: `/CLAUDE.md`
- Skill selection: `.claude/skills/SKILL-SELECTION-GUIDE.md`
- Base UI components: `src/components/ui/`
- Telebiz components: `src/telebiz/components/`
- Skills: `.claude/skills/telebiz-*`
