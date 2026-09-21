/**
 * JSON-schema for the UI spec the planner produces. Shared across LLM adapters.
 *
 * Note: `props` is factored into its own `anyOf` (rather than full {type,title,props}
 * variants) to avoid Anthropic's "compiled grammar too large" limit when every
 * variant repeats `additionalProperties:false` + the wrapper object.
 */

const statItem = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    value: { type: 'string' },
    hint: { type: 'string' },
  },
  required: ['label', 'value'],
  additionalProperties: false,
}

export const propsSchema = {
  anyOf: [
    {
      type: 'object',
      properties: { items: { type: 'array', items: statItem } },
      required: ['items'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, label: { type: 'string' } },
            required: ['key', 'label'],
            additionalProperties: false,
          },
        },
        rowsPath: {
          type: 'string',
          description:
            'Dot-path into the fetched data pointing at the array of row objects, e.g. "results" or "" when the root is the array',
        },
      },
      required: ['columns', 'rowsPath'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              subtitle: { type: 'string' },
              meta: { type: 'string' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, value: { type: 'string' } },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['pairs'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        chartType: { type: 'string', enum: ['bar', 'line', 'pie'] },
        values: { type: 'array', items: { type: 'number' } },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['chartType', 'values', 'labels'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'string' } } },
      required: ['items'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
        message: { type: 'string' },
      },
      required: ['severity', 'message'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              action: { type: 'string', enum: ['link', 'notify'] },
              url: { type: 'string', description: 'Required when action is "link"' },
              message: { type: 'string', description: 'Required when action is "notify"' },
            },
            required: ['label', 'action'],
            additionalProperties: false,
          },
        },
      },
      required: ['actions'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        kicker: { type: 'string' },
        subtitle: { type: 'string' },
        submitLabel: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string' },
              required: { type: 'boolean' },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['brand', 'fields'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['map', 'board'] },
        title: { type: 'string' },
        kicker: { type: 'string' },
        subtitle: { type: 'string' },
        tools: { type: 'array', items: { type: 'string' } },
        layers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              kind: { type: 'string' },
              status: { type: 'string' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['mode', 'title', 'tools'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        kicker: { type: 'string' },
        headline: { type: 'string' },
        cta: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              copy: { type: 'string' },
              cta: { type: 'string' },
            },
            required: ['copy'],
            additionalProperties: false,
          },
        },
      },
      required: ['brand', 'headline'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        kicker: { type: 'string' },
        subtitle: { type: 'string' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string' },
              detail: { type: 'string' },
              qty: { type: 'number' },
              price: {},
            },
            required: ['product'],
            additionalProperties: false,
          },
        },
        totals: {
          type: 'object',
          properties: {
            subtotal: {},
            shipping: {},
            tax: {},
            total: {},
          },
          additionalProperties: false,
        },
      },
      required: ['brand', 'lines'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        kicker: { type: 'string' },
        subtitle: { type: 'string' },
        plans: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: {},
              perks: { type: 'string' },
              featured: { type: 'boolean' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['brand', 'plans'],
      additionalProperties: false,
    },
  ],
}

const workStageProps = propsSchema.anyOf.find((variant) => variant.properties?.mode)

export const workspaceUiSpecSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string', description: 'One-sentence description of the workspace' },
    presentation: {
      type: 'string',
      enum: ['page'],
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['work-stage'] },
          title: { type: 'string' },
          props: workStageProps,
        },
        required: ['type', 'props'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'summary', 'presentation', 'components'],
  additionalProperties: false,
}

export const componentSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: [
        'stat-grid',
        'table',
        'list',
        'key-value',
        'chart',
        'text',
        'badge-row',
        'alert',
        'action-row',
        'login-form',
        'work-stage',
        'landing-page',
        'checkout',
        'pricing',
      ],
    },
    title: { type: 'string' },
    props: propsSchema,
  },
  required: ['type', 'props'],
  additionalProperties: false,
}

export const uiSpecSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string', description: 'One-sentence description of what the data shows' },
    presentation: {
      type: 'string',
      enum: ['page', 'modal', 'component'],
      description:
        'Layout container. "page": full-width dashboard layout (default). "modal": a single centered dialog/popup card over a dimmed backdrop — use when the user instructions ask for a popup, modal, dialog, or overlay. "component": a single bare component with no page chrome, for embedding inline — use when instructions ask for just one widget/snippet.',
    },
    components: { type: 'array', items: componentSchema },
  },
  required: ['title', 'summary', 'presentation', 'components'],
  additionalProperties: false,
}
