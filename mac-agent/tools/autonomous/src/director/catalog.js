/** Built-in slices the Director queues on its own after the foundation ladder. */
export const SLICE_CATALOG = [
  {
    id: 'slice-ui-appeal',
    title: 'Menu bar visual pass',
    why: 'The panel is a control list; ship a designed Mac agent surface',
    skill: 'auto-engineer',
    mode: 'mac-ui-appeal',
    priority: 'P1',
    risk: 'KNOWN',
    evidence: 'docs/ui/VISUAL_PASS.md',
    acceptance: ['docs/ui/VISUAL_PASS.md', 'AgentChrome in MacAgentMenuBarApp.swift'],
  },
  {
    id: 'slice-ax-live',
    title: 'Record live AX click/type journey',
    why: 'Prove Accessibility actions after the user grants permission',
    skill: 'auto-poc',
    mode: 'mac-ax-live',
    priority: 'P0',
    risk: 'RISKY',
    evidence: 'docs/poc/mac-ax-journey-live.md',
    acceptance: ['docs/poc/mac-ax-journey-live.md'],
  },
]
