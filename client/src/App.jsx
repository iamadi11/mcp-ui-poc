import { useState, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import {
  applyGlassCss,
  readStoredGlass,
  DEFAULT_GLASS,
  GLASS_STORAGE_KEY,
} from './glassAppearance.js'
import {
  readOrCreateUserId,
  resetUserId,
  formatUserIdShort,
} from './userSession.js'
import { errorFromResponse } from './apiError.js'
import {
  McpPreviewRouter,
  normalizeMcpPreviewResponse,
} from './StructuredUIPreview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'

function submissionSummaryFromPayload(data) {
  if (data && Array.isArray(data.submissions)) {
    return { kind: 'count', n: data.submissions.length }
  }
  if (data && data.kind === 'form-submit') {
    return { kind: 'count', n: 1 }
  }
  return null
}

function submissionEntriesFromParsed(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.submissions)) return data.submissions
  if (data.kind === 'form-submit') return [data]
  return []
}

function submissionEntriesFromJsonText(jsonText) {
  if (!jsonText) return []
  try {
    return submissionEntriesFromParsed(JSON.parse(jsonText))
  } catch {
    return []
  }
}

function truncatePreview(str, max) {
  if (str.length <= max) return str
  return `${str.slice(0, max)}…`
}

function GlassControls({ glass, setGlass }) {
  const [open, setOpen] = useState(false)

  const update = (key) => (e) => {
    const v = Number(e.target.value)
    setGlass((g) => ({ ...g, [key]: v }))
  }

  return (
    <aside className="glass-controls">
      <button
        type="button"
        className="glass-controls__fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="glass-controls-panel"
        id="glass-controls-trigger"
      >
        Glass
      </button>
      {open && (
        <div
          id="glass-controls-panel"
          className="glass-controls__panel"
          role="region"
          aria-labelledby="glass-controls-trigger"
        >
          <div className="glass-controls__head">
            <span className="glass-controls__title">Glass look</span>
            <button
              type="button"
              className="glass-controls__reset"
              onClick={() => setGlass({ ...DEFAULT_GLASS })}
            >
              Reset
            </button>
          </div>

          <div className="glass-controls__row">
            <div className="glass-controls__row-top">
              <label htmlFor="glass-blur">Blur</label>
              <span className="glass-controls__val">{glass.blur}px</span>
            </div>
            <input
              id="glass-blur"
              type="range"
              min={6}
              max={44}
              value={glass.blur}
              onChange={update('blur')}
            />
          </div>

          <div className="glass-controls__row">
            <div className="glass-controls__row-top">
              <label htmlFor="glass-frost">Frost</label>
              <span className="glass-controls__val">{glass.frost}</span>
            </div>
            <input
              id="glass-frost"
              type="range"
              min={0}
              max={100}
              value={glass.frost}
              onChange={update('frost')}
            />
          </div>

          <div className="glass-controls__row">
            <div className="glass-controls__row-top">
              <label htmlFor="glass-border">Edge light</label>
              <span className="glass-controls__val">{glass.border}</span>
            </div>
            <input
              id="glass-border"
              type="range"
              min={0}
              max={100}
              value={glass.border}
              onChange={update('border')}
            />
          </div>

          <div className="glass-controls__row">
            <div className="glass-controls__row-top">
              <label htmlFor="glass-sat">Color pop</label>
              <span className="glass-controls__val">{glass.saturate}%</span>
            </div>
            <input
              id="glass-sat"
              type="range"
              min={100}
              max={220}
              value={glass.saturate}
              onChange={update('saturate')}
            />
          </div>

          <div className="glass-controls__row">
            <div className="glass-controls__row-top">
              <label htmlFor="glass-mesh">Backdrop mesh</label>
              <span className="glass-controls__val">{glass.mesh}</span>
            </div>
            <input
              id="glass-mesh"
              type="range"
              min={0}
              max={100}
              value={glass.mesh}
              onChange={update('mesh')}
            />
          </div>

          <div className="glass-controls__row">
            <div className="glass-controls__row-top">
              <label htmlFor="glass-round">Roundness</label>
              <span className="glass-controls__val">{glass.roundness}</span>
            </div>
            <input
              id="glass-round"
              type="range"
              min={0}
              max={100}
              value={glass.roundness}
              onChange={update('roundness')}
            />
          </div>

          <p className="glass-controls__hint">Saved in this browser only.</p>
        </div>
      )}
    </aside>
  )
}

// Form Builder Component (shadcn/ui + Tailwind)
function FormBuilder({ onGenerateForm, generating }) {
  const [formConfig, setFormConfig] = useState({
    title: 'Contact Form',
    fields: [
      {
        name: 'name',
        type: 'text',
        label: 'Full Name',
        placeholder: 'Enter your full name',
        required: true,
      },
      {
        name: 'email',
        type: 'email',
        label: 'Email Address',
        placeholder: 'Enter your email',
        required: true,
      },
    ],
    submitText: 'Submit',
  })

  const addField = () => {
    setFormConfig((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          name: `field_${prev.fields.length + 1}`,
          type: 'text',
          label: 'New Field',
          placeholder: 'Enter value',
          required: false,
        },
      ],
    }))
  }

  const updateField = (index, field) => {
    setFormConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? field : f)),
    }))
  }

  const removeField = (index) => {
    setFormConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = () => {
    onGenerateForm(formConfig)
  }

  return (
    <Card className="form-builder-card border-border/50 bg-card/50 text-card-foreground shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Form Builder</CardTitle>
        <CardDescription>
          Title, submit label, and field list are sent to{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /api/generate-form
          </code>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="form-title">Form title</Label>
            <Input
              id="form-title"
              value={formConfig.title}
              onChange={(e) =>
                setFormConfig((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-submit">Submit button text</Label>
            <Input
              id="form-submit"
              value={formConfig.submitText}
              onChange={(e) =>
                setFormConfig((prev) => ({
                  ...prev,
                  submitText: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="form-builder-fields-header flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold tracking-tight">Fields</h4>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              Add field
            </Button>
          </div>

          {formConfig.fields.map((field, index) => (
            <Card
              key={index}
              className="form-builder-field-card border-border/40 bg-muted/15 py-0 shadow-none"
            >
              <CardContent className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor={`field-${index}-name`}>Name</Label>
                    <Input
                      id={`field-${index}-name`}
                      placeholder="field_name"
                      value={field.name}
                      onChange={(e) =>
                        updateField(index, { ...field, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`field-${index}-type`}>Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value) =>
                        updateField(index, { ...field, type: value })
                      }
                    >
                      <SelectTrigger
                        id={`field-${index}-type`}
                        className="w-full min-w-0"
                        size="default"
                      >
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                        <SelectItem value="textarea">Textarea</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`field-${index}-label`}>Label</Label>
                    <Input
                      id={`field-${index}-label`}
                      placeholder="Label"
                      value={field.label}
                      onChange={(e) =>
                        updateField(index, { ...field, label: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`field-${index}-ph`}>Placeholder</Label>
                    <Input
                      id={`field-${index}-ph`}
                      placeholder="Placeholder"
                      value={field.placeholder || ''}
                      onChange={(e) =>
                        updateField(index, {
                          ...field,
                          placeholder: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-builder-field-actions flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`field-${index}-required`}
                      checked={field.required}
                      onCheckedChange={(checked) =>
                        updateField(index, {
                          ...field,
                          required: checked === true,
                        })
                      }
                    />
                    <Label
                      htmlFor={`field-${index}-required`}
                      className="text-sm font-normal"
                    >
                      Required
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeField(index)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 border-t border-border/40 pt-6 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={generating}
          aria-busy={generating}
        >
          {generating ? 'Generating…' : 'Generate form'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function dashboardDefaultDataForType(type) {
  if (type === 'metric') return { value: '0', label: 'No data' }
  if (type === 'list') return { items: ['Item 1', 'Item 2', 'Item 3'] }
  return {
    chartType: 'bar',
    values: [100, 150, 200],
    labels: ['Jan', 'Feb', 'Mar'],
  }
}

// Dashboard Builder Component (shadcn/ui + Tailwind)
function DashboardBuilder({ onGenerateDashboard, generating }) {
  const [dashboardConfig, setDashboardConfig] = useState({
    title: 'Analytics Dashboard',
    widgets: [
      {
        type: 'metric',
        title: 'Total Users',
        data: { value: '1,234', label: 'Active users' },
      },
      {
        type: 'list',
        title: 'Recent Activities',
        data: { items: ['User login', 'Data update', 'Report generated'] },
      },
      {
        type: 'chart',
        title: 'Sales Chart',
        data: {
          values: [100, 150, 200, 175],
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        },
      },
    ],
  })

  const addWidget = () => {
    setDashboardConfig((prev) => ({
      ...prev,
      widgets: [
        ...prev.widgets,
        {
          type: 'metric',
          title: 'New Widget',
          data: { value: '0', label: 'No data' },
        },
      ],
    }))
  }

  const updateWidget = (index, widget) => {
    setDashboardConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w, i) => (i === index ? widget : w)),
    }))
  }

  const removeWidget = (index) => {
    setDashboardConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = () => {
    onGenerateDashboard(dashboardConfig)
  }

  return (
    <Card className="dashboard-builder-card border-border/50 bg-card/50 text-card-foreground shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Dashboard Builder</CardTitle>
        <CardDescription>
          Widget list maps to{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /api/generate-dashboard
          </code>
          . Switching type resets sample data for that widget shape.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="dashboard-title">Dashboard title</Label>
          <Input
            id="dashboard-title"
            value={dashboardConfig.title}
            onChange={(e) =>
              setDashboardConfig((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold tracking-tight">Widgets</h4>
            <Button type="button" variant="outline" size="sm" onClick={addWidget}>
              Add widget
            </Button>
          </div>

          {dashboardConfig.widgets.map((widget, index) => (
            <Card
              key={index}
              className="border-border/40 bg-muted/15 py-0 shadow-none"
            >
              <CardContent className="space-y-4 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`widget-${index}-type`}>Type</Label>
                    <Select
                      value={widget.type}
                      onValueChange={(newType) => {
                        updateWidget(index, {
                          ...widget,
                          type: newType,
                          data: dashboardDefaultDataForType(newType),
                        })
                      }}
                    >
                      <SelectTrigger
                        id={`widget-${index}-type`}
                        className="w-full min-w-0"
                      >
                        <SelectValue placeholder="Widget type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="chart">Chart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`widget-${index}-title`}>Title</Label>
                    <Input
                      id={`widget-${index}-title`}
                      placeholder="Widget title"
                      value={widget.title}
                      onChange={(e) =>
                        updateWidget(index, {
                          ...widget,
                          title: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                {widget.type === 'chart' && (
                  <div className="space-y-2">
                    <Label htmlFor={`widget-${index}-chart-type`}>
                      Chart style
                    </Label>
                    <Select
                      value={widget.data?.chartType ?? 'bar'}
                      onValueChange={(newChartType) =>
                        updateWidget(index, {
                          ...widget,
                          data: {
                            ...dashboardDefaultDataForType('chart'),
                            ...widget.data,
                            chartType: newChartType,
                          },
                        })
                      }
                    >
                      <SelectTrigger
                        id={`widget-${index}-chart-type`}
                        className="w-full min-w-0"
                      >
                        <SelectValue placeholder="Chart style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar chart</SelectItem>
                        <SelectItem value="pie">Pie chart</SelectItem>
                        <SelectItem value="line">Line chart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end border-t border-border/40 pt-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeWidget(index)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 border-t border-border/40 pt-6 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={generating}
          aria-busy={generating}
        >
          {generating ? 'Generating…' : 'Generate dashboard'}
        </Button>
      </CardFooter>
    </Card>
  )
}

// Chart Builder Component (shadcn/ui + Tailwind)
function ChartBuilder({ onGenerateChart, generating }) {
  const [chartConfig, setChartConfig] = useState({
    title: 'Sales Chart',
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      values: [100, 150, 200, 175],
    },
  })

  const handleSubmit = () => {
    onGenerateChart(chartConfig)
  }

  return (
    <Card className="chart-builder-card border-border/50 bg-card/50 text-card-foreground shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Chart Builder</CardTitle>
        <CardDescription>
          Values and labels are comma-separated lists sent to{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            POST /api/generate-chart
          </code>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="chart-title">Chart title</Label>
            <Input
              id="chart-title"
              value={chartConfig.title}
              onChange={(e) =>
                setChartConfig((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chart-type">Chart type</Label>
            <Select
              value={chartConfig.type}
              onValueChange={(value) =>
                setChartConfig((prev) => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger id="chart-type" className="w-full min-w-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar chart</SelectItem>
                <SelectItem value="pie">Pie chart</SelectItem>
                <SelectItem value="line">Line chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="chart-values">Values (comma-separated)</Label>
            <Input
              id="chart-values"
              value={chartConfig.data.values.join(', ')}
              onChange={(e) =>
                setChartConfig((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    values: e.target.value
                      .split(',')
                      .map((v) => parseInt(v.trim(), 10) || 0),
                  },
                }))
              }
              placeholder="100, 150, 200, 175"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chart-labels">Labels (comma-separated)</Label>
            <Input
              id="chart-labels"
              value={chartConfig.data.labels.join(', ')}
              onChange={(e) =>
                setChartConfig((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    labels: e.target.value.split(',').map((v) => v.trim()),
                  },
                }))
              }
              placeholder="Jan, Feb, Mar, Apr"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 border-t border-border/40 pt-6 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={generating}
          aria-busy={generating}
        >
          {generating ? 'Generating…' : 'Generate chart'}
        </Button>
      </CardFooter>
    </Card>
  )
}

// AI Generator Component
function AIGenerator({ onGenerateAI, userId }) {
  const [description, setDescription] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Load templates on component mount
  useEffect(() => {
    fetch('/api/ai/templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates))
      .catch(err => console.error('Error loading templates:', err));
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setSubmitError('Please enter a description.');
      return;
    }

    setSubmitError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          description: description.trim(),
        }),
      });
      
      if (!response.ok) {
        throw await errorFromResponse(response)
      }

      const data = await response.json()
      onGenerateAI(data)
      setDescription('');
    } catch (error) {
      console.error('Error generating AI component:', error);
      const msg =
        error instanceof Error ? error.message : 'Failed to generate component';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template) => {
    setDescription(template.description);
    setSubmitError(null);
  };

  return (
    <div className="ai-generator">
      <h3>AI-Powered Component Generator</h3>
      <p className="ai-description">
        Describe the component you want to create using natural language. 
        The AI will generate a component based on your description.
      </p>
      
      <div className="form-group">
        <label>Component Description:</label>
        <textarea
          className="form-control"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            if (submitError) setSubmitError(null)
          }}
          placeholder="e.g., Create a contact form with name, email, and message fields"
          rows={4}
        />
      </div>

      {templates.length > 0 && (
        <div className="templates-section">
          <h4>Quick Templates</h4>
          <div className="template-buttons">
            {templates.map((template, index) => (
              <button
                key={index}
                onClick={() => applyTemplate(template)}
                className="btn btn-outline template-btn"
              >
                {template.type}
              </button>
            ))}
          </div>
        </div>
      )}

      {submitError && (
        <div className="error-message ai-generator__error" role="alert">
          <p>{submitError}</p>
        </div>
      )}

      <button 
        onClick={handleSubmit} 
        className="btn btn-success generate-btn"
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate Component'}
      </button>
    </div>
  );
}

function App() {
  const [glass, setGlass] = useState(() => readStoredGlass())
  const [health, setHealth] = useState({ state: 'checking' })
  const [mcpUIResource, setMcpUIResource] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState(null)
  const [builderGenerating, setBuilderGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('ai')
  const [userId, setUserId] = useState(() => readOrCreateUserId())
  const [storedView, setStoredView] = useState({
    phase: 'idle',
    jsonText: '',
    error: '',
    fetchedAt: null,
    submissionSummary: null,
  })

  const loadStoredData = useCallback(async () => {
    setStoredView((v) => ({ ...v, phase: 'loading', error: '' }))
    try {
      const res = await fetch(
        `/api/get-data/${encodeURIComponent(userId)}`
      )
      const body = await res.json().catch(() => ({}))
      if (res.status === 404) {
        setStoredView({
          phase: 'empty',
          jsonText: '',
          error: '',
          fetchedAt: new Date(),
          submissionSummary: null,
        })
        return
      }
      if (!res.ok) {
        throw await errorFromResponse(res, body)
      }
      const data = body.data
      setStoredView({
        phase: 'ready',
        jsonText: JSON.stringify(data, null, 2),
        error: '',
        fetchedAt: new Date(),
        submissionSummary: submissionSummaryFromPayload(data),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      setStoredView({
        phase: 'error',
        jsonText: '',
        error: msg,
        fetchedAt: new Date(),
        submissionSummary: null,
      })
    }
  }, [userId])

  const copyStoredJson = useCallback(async () => {
    if (storedView.phase !== 'ready' || !storedView.jsonText) return
    try {
      await navigator.clipboard.writeText(storedView.jsonText)
      const id = Date.now()
      const note = {
        id,
        message: 'Copied stored JSON to clipboard',
        type: 'info',
      }
      setNotifications((prev) => [...prev, note])
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 3200)
    } catch {
      const id = Date.now()
      setNotifications((prev) => [
        ...prev,
        {
          id,
          message: 'Could not copy (clipboard permission?)',
          type: 'error',
        },
      ])
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 5000)
    }
  }, [storedView.phase, storedView.jsonText])

  const pushToast = useCallback(
    (message, type = 'info', dismissMs = 5000) => {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setNotifications((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }, dismissMs)
    },
    []
  )

  const storedTimelineEntries = useMemo(() => {
    if (storedView.phase !== 'ready' || !storedView.jsonText) return []
    const raw = submissionEntriesFromJsonText(storedView.jsonText)
    return [...raw].reverse().slice(0, 15)
  }, [storedView.phase, storedView.jsonText])

  useEffect(() => {
    setStoredView({
      phase: 'idle',
      jsonText: '',
      error: '',
      fetchedAt: null,
      submissionSummary: null,
    })
  }, [userId])

  useEffect(() => {
    applyGlassCss(glass)
    try {
      localStorage.setItem(GLASS_STORAGE_KEY, JSON.stringify(glass))
    } catch {
      /* ignore quota */
    }
  }, [glass])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyGlassCss(glass)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [glass])

  const checkHealth = useCallback(async () => {
    setHealth({ state: 'checking' })
    const controller = new AbortController()
    const timeoutMs = 15000
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch('/api/health', { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setHealth({ state: 'ok', payload: data })
    } catch (err) {
      clearTimeout(timer)
      console.error('Server health check failed:', err)
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `Timed out after ${timeoutMs / 1000}s`
            : err.message
          : 'Request failed'
      setHealth({
        state: 'error',
        message
      })
    }
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  // Generate Form UI
  const generateForm = async (formConfig) => {
    setError(null)
    setBuilderGenerating(true)
    try {
      const response = await fetch('/api/generate-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, formConfig }),
      });
      
      if (!response.ok) {
        throw await errorFromResponse(response)
      }

      const data = await response.json()
      setMcpUIResource(normalizeMcpPreviewResponse(data))
    } catch (error) {
      console.error('Error generating form:', error);
      setError(error.message);
    } finally {
      setBuilderGenerating(false)
    }
  };

  // Generate Dashboard UI
  const generateDashboard = async (dashboardConfig) => {
    setError(null)
    setBuilderGenerating(true)
    try {
      const response = await fetch('/api/generate-dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, dashboardConfig }),
      });
      
      if (!response.ok) {
        throw await errorFromResponse(response)
      }

      const data = await response.json()
      setMcpUIResource(normalizeMcpPreviewResponse(data))
    } catch (error) {
      console.error('Error generating dashboard:', error);
      setError(error.message);
    } finally {
      setBuilderGenerating(false)
    }
  };

  // Generate Chart UI
  const generateChart = async (chartConfig) => {
    setError(null)
    setBuilderGenerating(true)
    try {
      const response = await fetch('/api/generate-chart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, chartConfig }),
      });
      
      if (!response.ok) {
        throw await errorFromResponse(response)
      }

      const data = await response.json()
      setMcpUIResource(normalizeMcpPreviewResponse(data))
    } catch (error) {
      console.error('Error generating chart:', error);
      setError(error.message);
    } finally {
      setBuilderGenerating(false)
    }
  };

  // Generate AI Component
  const generateAI = async (aiPayload) => {
    setMcpUIResource(normalizeMcpPreviewResponse(aiPayload));
  };

  // Handle MCP UI actions
  const handleUIAction = (action) => {
    console.log('MCP UI Action:', action)
    
    if (action.type === 'tool') {
      const { toolName, params } = action.payload
      
      switch (toolName) {
        case 'applySettings':
          pushToast(
            `Settings applied: Theme=${params.theme}, Font Size=${params.fontSize}px`,
            'info'
          )
          break
        case 'setAnimationSpeed':
          pushToast(`Animation speed set to: ${params.speed}`, 'info')
          break
        default:
          console.log('Unknown tool:', toolName, params)
      }
    } else if (action.type === 'notify') {
      // Add notification to the list
      const newNotification = {
        id: Date.now(),
        message: action.payload.message,
        type: 'info'
      }
      setNotifications(prev => [...prev, newNotification])
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
      }, 5000)
    } else if (action.type === 'form-submit') {
      const payload = action.payload
      const preview =
        payload.preview === 'html' ? 'html' : 'structured'
      const stored = {
        kind: 'form-submit',
        formId: payload.formId,
        submittedAt: new Date().toISOString(),
        data: payload.data,
        preview,
      }
      ;(async () => {
        try {
          const res = await fetch('/api/store-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, data: stored }),
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw await errorFromResponse(res, body)
          }
          const newNotification = {
            id: Date.now(),
            message: `Form saved for this session: ${JSON.stringify(payload.data)}`,
            type: 'success',
          }
          setNotifications((prev) => [...prev, newNotification])
          setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id))
          }, 5000)
          void loadStoredData()
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Failed to store submission'
          const newNotification = {
            id: Date.now(),
            message: `Could not save form data: ${msg}`,
            type: 'error',
          }
          setNotifications((prev) => [...prev, newNotification])
          setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id))
          }, 8000)
        }
      })()
    } else if (action.type === 'dashboard-refresh') {
      // Handle dashboard refresh
      const newNotification = {
        id: Date.now(),
        message: `Dashboard refreshed: ${action.payload.dashboardId}`,
        type: 'info'
      }
      setNotifications(prev => [...prev, newNotification])
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
      }, 5000)
    } else if (action.type === 'chart-export') {
      // Handle chart export
      const newNotification = {
        id: Date.now(),
        message: `Chart exported: ${action.payload.chartId}`,
        type: 'success'
      }
      setNotifications(prev => [...prev, newNotification])
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
      }, 5000)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dynamic MCP UI Generator</h1>
        <p className="user-session" role="status">
          <span className="user-session__label">Demo user id</span>
          <code className="user-session__id" title={userId}>
            {formatUserIdShort(userId)}
          </code>
          <button
            type="button"
            className="btn btn-outline user-session__reset"
            onClick={() => {
              if (
                window.confirm(
                  'Start a new session? The server will treat the next actions as a different user.'
                )
              ) {
                setUserId(resetUserId())
              }
            }}
          >
            New session
          </button>
        </p>
        <section
          className="stored-data-panel"
          aria-labelledby="stored-data-heading"
        >
          <div className="stored-data-panel__head">
            <div className="stored-data-panel__title-row">
              <h2 id="stored-data-heading" className="stored-data-panel__title">
                Stored data (server)
              </h2>
              {storedView.submissionSummary && (
                <span className="stored-data-panel__badge" aria-label="Form submits stored">
                  {storedView.submissionSummary.n} submit
                  {storedView.submissionSummary.n === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="stored-data-panel__actions">
              <button
                type="button"
                className="btn btn-outline stored-data-panel__refresh"
                onClick={() => void loadStoredData()}
                disabled={storedView.phase === 'loading'}
              >
                {storedView.phase === 'loading' ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                className="btn btn-outline stored-data-panel__copy"
                onClick={() => void copyStoredJson()}
                disabled={
                  storedView.phase !== 'ready' || !storedView.jsonText
                }
              >
                Copy JSON
              </button>
            </div>
          </div>
          <p className="stored-data-panel__hint">
            In-memory for this demo; structured form submits append (up to 50 per
            id). Other JSON bodies replace the bucket. Matches{' '}
            <code className="stored-data-panel__code">GET /api/get-data/:userId</code>.
          </p>
          {storedView.fetchedAt && (
            <p className="stored-data-panel__meta">
              {storedView.phase === 'error' ? 'Attempted' : 'Fetched'}{' '}
              {storedView.fetchedAt.toLocaleString()}
            </p>
          )}
          <div
            className="stored-data-panel__body"
            role="region"
            aria-live="polite"
            aria-label="Payload returned from get-data"
          >
            {storedView.phase === 'idle' && (
              <p className="stored-data-panel__placeholder">
                Tap Refresh to load what the server holds for this session id.
              </p>
            )}
            {storedView.phase === 'loading' && (
              <p className="stored-data-panel__placeholder">Loading…</p>
            )}
            {storedView.phase === 'empty' && (
              <p className="stored-data-panel__placeholder">
                No data yet for this id (submit a generated form in Data preview
                first).
              </p>
            )}
            {storedView.phase === 'ready' && (
              <div className="stored-data-panel__ready">
                {storedTimelineEntries.length > 0 && (
                  <div className="stored-data-panel__timeline-wrap">
                    <p
                      id="stored-timeline-label"
                      className="stored-data-panel__timeline-label"
                    >
                      Recent form submits (newest first)
                    </p>
                    <ol
                      className="stored-data-panel__timeline"
                      aria-labelledby="stored-timeline-label"
                    >
                      {storedTimelineEntries.map((entry, i) => (
                        <li
                          key={
                            entry.storedAt
                              ? `${entry.storedAt}-${entry.formId}-${i}`
                              : `entry-${entry.formId}-${i}`
                          }
                        >
                          <div className="stored-data-panel__timeline-row">
                            <span className="stored-data-panel__timeline-id">
                              {entry.formId ?? 'form'}
                            </span>
                            <span
                              className={`stored-data-panel__preview-pill ${
                                entry.preview === 'html'
                                  ? 'stored-data-panel__preview-pill--html'
                                  : ''
                              }`}
                            >
                              {entry.preview === 'html' ? 'HTML' : 'Data'}
                            </span>
                            {entry.storedAt ? (
                              <time
                                className="stored-data-panel__timeline-time"
                                dateTime={entry.storedAt}
                              >
                                {new Date(entry.storedAt).toLocaleString()}
                              </time>
                            ) : (
                              <span className="stored-data-panel__timeline-time">
                                (no timestamp)
                              </span>
                            )}
                          </div>
                          <div className="stored-data-panel__timeline-data">
                            {truncatePreview(
                              JSON.stringify(entry.data ?? {}),
                              140
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {storedTimelineEntries.length > 0 ? (
                  <details className="stored-data-panel__raw">
                    <summary>Raw JSON</summary>
                    <pre className="stored-data-panel__pre">
                      {storedView.jsonText}
                    </pre>
                  </details>
                ) : (
                  <pre className="stored-data-panel__pre">
                    {storedView.jsonText}
                  </pre>
                )}
              </div>
            )}
            {storedView.phase === 'error' && (
              <p className="stored-data-panel__err">{storedView.error}</p>
            )}
          </div>
        </section>
        <div
          className={`server-status ${
            health.state === 'ok'
              ? 'status-ok'
              : health.state === 'error'
                ? 'status-error'
                : 'status-checking'
          }`}
          role="status"
          aria-live="polite"
          aria-busy={health.state === 'checking'}
        >
          {health.state === 'checking' && (
            <span className="status-label">Checking API connection…</span>
          )}
          {health.state === 'ok' && health.payload && (
            <span className="status-label">
              API connected
              {health.payload.timestamp && (
                <span className="status-meta">
                  {' '}
                  ({new Date(health.payload.timestamp).toLocaleTimeString()})
                </span>
              )}
              {health.payload.mcp && (
                <span className="status-mcp-line">
                  <span className="status-mcp-seg" title="Tracked UI components vs limit">
                    UI {health.payload.mcp.uiComponentCount}/
                    {health.payload.mcp.limits.maxUiComponents}
                  </span>
                  <span className="status-mcp-dot" aria-hidden="true">
                    ·
                  </span>
                  <span className="status-mcp-seg" title="User data keys vs limit">
                    Keys {health.payload.mcp.userDataKeyCount}/
                    {health.payload.mcp.limits.maxUserDataKeys}
                  </span>
                  <span className="status-mcp-dot" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className="status-mcp-seg"
                    title="Max form-submit rows stored per user id"
                  >
                    ≤{health.payload.mcp.limits.maxSubmissionsPerUser} subs/user
                  </span>
                  {health.payload.mcp.limits.maxHtmlBytes != null && (
                    <>
                      <span className="status-mcp-dot" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className="status-mcp-seg"
                        title="Max UTF-8 bytes for one generated HTML document"
                      >
                        HTML ≤
                        {Math.round(
                          health.payload.mcp.limits.maxHtmlBytes / 1024
                        )}{' '}
                        KiB
                      </span>
                    </>
                  )}
                </span>
              )}
            </span>
          )}
          {health.state === 'error' && (
            <div className="status-error-body">
              <span className="status-label">
                Cannot reach API ({health.message}). Start the backend on port 3001 (
                <code className="status-code">npm run dev</code> from the repo root).
              </span>
              <button
                type="button"
                className="btn status-retry"
                onClick={() => checkHealth()}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.map(notification => (
            <div key={notification.id} className={`notification ${notification.type}`}>
              {notification.message}
            </div>
          ))}
        </div>
      )}

      <main className="app-main">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="tab-navigation">
            <TabsTrigger value="ai" className="tab-btn">
              AI Generator
            </TabsTrigger>
            <TabsTrigger value="form" className="tab-btn">
              Form Builder
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="tab-btn">
              Dashboard Builder
            </TabsTrigger>
            <TabsTrigger value="chart" className="tab-btn">
              Chart Builder
            </TabsTrigger>
          </TabsList>

          <section className="mcp-ui-section">
            <div className="section-header kit-badges">
              <span className="kit-badges__label">Shell UI</span>
              <Badge variant="secondary">Tailwind 4</Badge>
              <Badge variant="outline">shadcn/ui</Badge>
            </div>

            <TabsContent value="ai" className="mt-0 outline-none">
              <div className="section-header">
                <h2>AI-Powered Component Generator</h2>
              </div>
              <AIGenerator onGenerateAI={generateAI} userId={userId} />
            </TabsContent>

            <TabsContent value="form" className="mt-0 outline-none">
              <div className="section-header">
                <h2>Dynamic Form Generator</h2>
              </div>
              <FormBuilder
                onGenerateForm={generateForm}
                generating={builderGenerating}
              />
            </TabsContent>

            <TabsContent value="dashboard" className="mt-0 outline-none">
              <div className="section-header">
                <h2>Dynamic Dashboard Generator</h2>
              </div>
              <DashboardBuilder
                onGenerateDashboard={generateDashboard}
                generating={builderGenerating}
              />
            </TabsContent>

            <TabsContent value="chart" className="mt-0 outline-none">
              <div className="section-header">
                <h2>Dynamic Chart Generator</h2>
              </div>
              <ChartBuilder
                onGenerateChart={generateChart}
                generating={builderGenerating}
              />
            </TabsContent>

            {error && (
              <div className="error-message">
                <p>Error: {error}</p>
              </div>
            )}

            {mcpUIResource && (
              <div className="generated-ui">
                <h3>Generated UI Component</h3>
                <McpPreviewRouter
                  preview={mcpUIResource}
                  onUIAction={handleUIAction}
                />
              </div>
            )}
          </section>
        </Tabs>
      </main>

      <GlassControls glass={glass} setGlass={setGlass} />
    </div>
  )
}

export default App 