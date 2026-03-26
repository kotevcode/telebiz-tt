import { memo, useCallback, useState } from '../../../../lib/teact/teact';

import type { ToolCall } from '../../../agent/types';

import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';

import styles from './ToolCallChip.module.scss';

interface OwnProps {
  toolCall?: ToolCall;
  /** Simple label mode — renders a static chip without expand/collapse */
  label?: string;
  /** Optional link — renders the chip as an <a> tag */
  href?: string;
}

// Format tool name for display (camelCase to Title Case)
function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

const ToolCallChip = ({ toolCall, label, href }: OwnProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Simple label mode
  if (label) {
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={styles.chip}>
          <span className={styles.name}>{label}</span>
        </a>
      );
    }

    return (
      <div className={styles.chip}>
        <span className={styles.name}>{label}</span>
      </div>
    );
  }

  if (!toolCall) return undefined;

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    // Ignore parse errors
  }

  const hasArgs = Object.keys(args).length > 0;

  return (
    <div className={styles.chipWrapper}>
      <button
        type="button"
        className={buildClassName(styles.chip, isExpanded && styles.expanded)}
        onClick={hasArgs ? handleClick : undefined}
      >
        <span className={styles.name}>{formatToolName(toolCall.function.name)}</span>
        <Icon name="check" className={styles.checkIcon} />
        {hasArgs && <Icon name={isExpanded ? 'up' : 'down'} className={styles.chevron} />}
      </button>

      {isExpanded && hasArgs && (
        <div className={styles.argsPanel}>
          <pre className={styles.argsCode}>
            {JSON.stringify(args, undefined, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default memo(ToolCallChip);
