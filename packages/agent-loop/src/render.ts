import type { Finding, LoopResult } from './loop.ts';

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function what({ path, line, finding }: Finding): string {
  const where = path ? `\`${path}${line ? `:${line}` : ''}\` ` : '';
  return cell(`${where}${finding}`);
}

/** The run's summary. Every finding and outcome is shown as its session returned it. */
export function render(result: LoopResult): string {
  const { rounds, costUsd, stopped, findings, outcomes, cold, blocked } = result;
  const lines = [
    `### Implement and review loop`,
    ``,
    `${rounds} round${rounds === 1 ? '' : 's'}, $${costUsd.toFixed(2)}. Stopped: ${stopped}.`,
    ``,
  ];

  if (findings.length === 0) {
    lines.push(`No findings.`);
  } else {
    lines.push(`| | From | Finding | Tier | Outcome |`, `| --- | --- | --- | --- | --- |`);
    for (const finding of findings) {
      const outcome = outcomes[finding.id];
      const answer = outcome ? cell(`${outcome.outcome}: ${outcome.reason}`) : 'open';
      lines.push(`| ${finding.id} | ${finding.source} | ${what(finding)} | ${finding.tier ?? ''} | ${answer} |`);
    }
  }

  lines.push(``, `#### Cold pass`, ``);
  if (cold === null) {
    lines.push(blocked ? `No cold pass: the coder is blocked.` : `No cold pass ran.`);
  } else if (cold.length === 0) {
    lines.push(`The cold pass found nothing.`);
  } else {
    lines.push(`| | Finding | Tier |`, `| --- | --- | --- |`);
    for (const finding of cold) lines.push(`| ${finding.id} | ${what(finding)} | ${finding.tier ?? ''} |`);
  }

  return lines.join('\n');
}
