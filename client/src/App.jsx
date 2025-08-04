import { useState, useEffect } from 'react'
import './App.css'

// Simple UI Resource Renderer component
function UIResourceRenderer({ resource, onUIAction }) {
  const handleMessage = (event) => {
    if (event.data && (event.data.type === 'tool' || event.data.type === 'notify' || 
        event.data.type === 'form-submit' || event.data.type === 'dashboard-refresh' || 
        event.data.type === 'chart-export')) {
      onUIAction(event.data);
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUIAction]);

  if (resource.mimeType === 'text/html') {
    return (
      <iframe
        srcDoc={resource.text}
        style={{
          width: '100%',
          height: '600px',
          border: 'none',
          borderRadius: '16px',
          backgroundColor: 'transparent'
        }}
        title="MCP-UI Resource"
      />
    );
  }

  return <div>Unsupported resource type: {resource.mimeType}</div>;
}

// Form Builder Component
function FormBuilder({ onGenerateForm }) {
  const [formConfig, setFormConfig] = useState({
    title: 'Contact Form',
    fields: [
      { name: 'name', type: 'text', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'email', type: 'email', label: 'Email Address', placeholder: 'Enter your email', required: true }
    ],
    submitText: 'Submit'
  });

  const addField = () => {
    setFormConfig(prev => ({
      ...prev,
      fields: [...prev.fields, {
        name: `field_${prev.fields.length + 1}`,
        type: 'text',
        label: 'New Field',
        placeholder: 'Enter value',
        required: false
      }]
    }));
  };

  const updateField = (index, field) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }));
  };

  const removeField = (index) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    onGenerateForm(formConfig);
  };

  return (
    <div className="form-builder">
      <h3>Form Builder</h3>
      
      <div className="form-group">
        <label>Form Title:</label>
        <input
          type="text"
          className="form-control"
          value={formConfig.title}
          onChange={(e) => setFormConfig(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>

      <div className="form-group">
        <label>Submit Button Text:</label>
        <input
          type="text"
          className="form-control"
          value={formConfig.submitText}
          onChange={(e) => setFormConfig(prev => ({ ...prev, submitText: e.target.value }))}
        />
      </div>

      <div className="fields-section">
        <h4>Form Fields</h4>
        {formConfig.fields.map((field, index) => (
          <div key={index} className="field-editor">
            <div className="field-row">
              <input
                type="text"
                className="form-control"
                placeholder="Field name"
                value={field.name}
                onChange={(e) => updateField(index, { ...field, name: e.target.value })}
              />
              <select
                className="form-control"
                value={field.type}
                onChange={(e) => updateField(index, { ...field, type: e.target.value })}
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
                <option value="textarea">Textarea</option>
              </select>
              <input
                type="text"
                className="form-control"
                placeholder="Label"
                value={field.label}
                onChange={(e) => updateField(index, { ...field, label: e.target.value })}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Placeholder"
                value={field.placeholder || ''}
                onChange={(e) => updateField(index, { ...field, placeholder: e.target.value })}
              />
              <label>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(index, { ...field, required: e.target.checked })}
                />
                Required
              </label>
              <button onClick={() => removeField(index)} className="btn btn-danger remove-btn">Remove</button>
            </div>
          </div>
        ))}
        <button onClick={addField} className="btn btn-success add-btn">Add Field</button>
      </div>

      <button onClick={handleSubmit} className="btn btn-success generate-btn">Generate Form</button>
    </div>
  );
}

// Dashboard Builder Component
function DashboardBuilder({ onGenerateDashboard }) {
  const [dashboardConfig, setDashboardConfig] = useState({
    title: 'Analytics Dashboard',
    widgets: [
      {
        type: 'metric',
        title: 'Total Users',
        data: { value: '1,234', label: 'Active users' }
      },
      {
        type: 'list',
        title: 'Recent Activities',
        data: { items: ['User login', 'Data update', 'Report generated'] }
      },
      {
        type: 'chart',
        title: 'Sales Chart',
        data: { 
          values: [100, 150, 200, 175],
          labels: ['Q1', 'Q2', 'Q3', 'Q4']
        }
      }
    ]
  });

  const addWidget = () => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: [...prev.widgets, {
        type: 'metric',
        title: 'New Widget',
        data: { value: '0', label: 'No data' }
      }]
    }));
  };

  const updateWidget = (index, widget) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map((w, i) => i === index ? widget : w)
    }));
  };

  const removeWidget = (index) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: prev.widgets.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    onGenerateDashboard(dashboardConfig);
  };

  return (
    <div className="dashboard-builder">
      <h3>Dashboard Builder</h3>
      
      <div className="form-group">
        <label>Dashboard Title:</label>
        <input
          type="text"
          className="form-control"
          value={dashboardConfig.title}
          onChange={(e) => setDashboardConfig(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>

      <div className="widgets-section">
        <h4>Widgets</h4>
        {dashboardConfig.widgets.map((widget, index) => (
          <div key={index} className="widget-editor">
            <div className="widget-row">
              <select
                className="form-control"
                value={widget.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  let newData = widget.data;
                  
                  // Update data structure based on widget type
                  if (newType === 'metric') {
                    newData = { value: '0', label: 'No data' };
                  } else if (newType === 'list') {
                    newData = { items: ['Item 1', 'Item 2', 'Item 3'] };
                  } else if (newType === 'chart') {
                    newData = { 
                      values: [100, 150, 200], 
                      labels: ['Jan', 'Feb', 'Mar'] 
                    };
                  }
                  
                  updateWidget(index, { ...widget, type: newType, data: newData });
                }}
              >
                <option value="metric">Metric</option>
                <option value="list">List</option>
                <option value="chart">Chart</option>
              </select>
              <input
                type="text"
                className="form-control"
                placeholder="Widget title"
                value={widget.title}
                onChange={(e) => updateWidget(index, { ...widget, title: e.target.value })}
              />
              <button onClick={() => removeWidget(index)} className="btn btn-danger remove-btn">Remove</button>
            </div>
          </div>
        ))}
        <button onClick={addWidget} className="btn btn-success add-btn">Add Widget</button>
      </div>

      <button onClick={handleSubmit} className="btn btn-success generate-btn">Generate Dashboard</button>
    </div>
  );
}

// Chart Builder Component
function ChartBuilder({ onGenerateChart }) {
  const [chartConfig, setChartConfig] = useState({
    title: 'Sales Chart',
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      values: [100, 150, 200, 175]
    }
  });

  const handleSubmit = () => {
    onGenerateChart(chartConfig);
  };

  return (
    <div className="chart-builder">
      <h3>Chart Builder</h3>
      
      <div className="form-group">
        <label>Chart Title:</label>
        <input
          type="text"
          className="form-control"
          value={chartConfig.title}
          onChange={(e) => setChartConfig(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>

      <div className="form-group">
        <label>Chart Type:</label>
        <select
          className="form-control"
          value={chartConfig.type}
          onChange={(e) => setChartConfig(prev => ({ ...prev, type: e.target.value }))}
        >
          <option value="bar">Bar Chart</option>
          <option value="pie">Pie Chart</option>
        </select>
      </div>

      <div className="form-group">
        <label>Data (comma-separated values):</label>
        <input
          type="text"
          className="form-control"
          value={chartConfig.data.values.join(', ')}
          onChange={(e) => setChartConfig(prev => ({
            ...prev,
            data: {
              ...prev.data,
              values: e.target.value.split(',').map(v => parseInt(v.trim()) || 0)
            }
          }))}
          placeholder="100, 150, 200, 175"
        />
      </div>

      <div className="form-group">
        <label>Labels (comma-separated):</label>
        <input
          type="text"
          className="form-control"
          value={chartConfig.data.labels.join(', ')}
          onChange={(e) => setChartConfig(prev => ({
            ...prev,
            data: {
              ...prev.data,
              labels: e.target.value.split(',').map(v => v.trim())
            }
          }))}
          placeholder="Jan, Feb, Mar, Apr"
        />
      </div>

      <button onClick={handleSubmit} className="btn btn-success generate-btn">Generate Chart</button>
    </div>
  );
}

// AI Generator Component
function AIGenerator({ onGenerateAI }) {
  const [description, setDescription] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load templates on component mount
  useEffect(() => {
    fetch('/api/ai/templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates))
      .catch(err => console.error('Error loading templates:', err));
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: `user-${Date.now()}`, 
          description: description.trim() 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      onGenerateAI(data);
      setDescription('');
    } catch (error) {
      console.error('Error generating AI component:', error);
      alert('Error generating component: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const useTemplate = (template) => {
    setDescription(template.description);
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
          onChange={(e) => setDescription(e.target.value)}
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
                onClick={() => useTemplate(template)}
                className="btn btn-outline template-btn"
              >
                {template.type}
              </button>
            ))}
          </div>
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
  const [serverStatus, setServerStatus] = useState(null)
  const [mcpUIResource, setMcpUIResource] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('ai')
  const [userId] = useState(`user-${Date.now()}`)

  // Check server health
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setServerStatus(data))
      .catch(err => console.error('Server health check failed:', err))
  }, [])

  // Generate Form UI
  const generateForm = async (formConfig) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, formConfig }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMcpUIResource(data.resource);
    } catch (error) {
      console.error('Error generating form:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate Dashboard UI
  const generateDashboard = async (dashboardConfig) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate-dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, dashboardConfig }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMcpUIResource(data.resource);
    } catch (error) {
      console.error('Error generating dashboard:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate Chart UI
  const generateChart = async (chartConfig) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate-chart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, chartConfig }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMcpUIResource(data.resource);
    } catch (error) {
      console.error('Error generating chart:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate AI Component
  const generateAI = async (aiResource) => {
    setMcpUIResource(aiResource);
  };

  // Handle MCP UI actions
  const handleUIAction = (action) => {
    console.log('MCP UI Action:', action)
    
    if (action.type === 'tool') {
      const { toolName, params } = action.payload
      
      switch (toolName) {
        case 'applySettings':
          alert(`Settings applied: Theme=${params.theme}, Font Size=${params.fontSize}px`)
          break
        case 'setAnimationSpeed':
          alert(`Animation speed set to: ${params.speed}`)
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
      // Handle form submission
      const newNotification = {
        id: Date.now(),
        message: `Form submitted: ${JSON.stringify(action.payload.data)}`,
        type: 'success'
      }
      setNotifications(prev => [...prev, newNotification])
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
      }, 5000)
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
        <div className="server-status">
          {serverStatus ? (
            <span className="status-ok">✅ Server Connected</span>
          ) : (
            <span className="status-error">❌ Server Disconnected</span>
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
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Generator
          </button>
          <button 
            className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            Form Builder
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard Builder
          </button>
          <button 
            className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
            onClick={() => setActiveTab('chart')}
          >
            Chart Builder
          </button>
        </div>

        <section className="mcp-ui-section">
          {activeTab === 'ai' && (
            <>
              <div className="section-header">
                <h2>AI-Powered Component Generator</h2>
              </div>
              <AIGenerator onGenerateAI={generateAI} />
            </>
          )}

          {activeTab === 'form' && (
            <>
              <div className="section-header">
                <h2>Dynamic Form Generator</h2>
              </div>
              <FormBuilder onGenerateForm={generateForm} />
            </>
          )}

          {activeTab === 'dashboard' && (
            <>
              <div className="section-header">
                <h2>Dynamic Dashboard Generator</h2>
              </div>
              <DashboardBuilder onGenerateDashboard={generateDashboard} />
            </>
          )}

          {activeTab === 'chart' && (
            <>
              <div className="section-header">
                <h2>Dynamic Chart Generator</h2>
              </div>
              <ChartBuilder onGenerateChart={generateChart} />
            </>
          )}

          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
            </div>
          )}

          {mcpUIResource && (
            <div className="generated-ui">
              <h3>Generated UI Component</h3>
              <UIResourceRenderer resource={mcpUIResource} onUIAction={handleUIAction} />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App 