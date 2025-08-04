import { createUIResource } from '@mcp-ui/server';

// MCP Server for dynamic UI generation
export class MCPServer {
  constructor() {
    this.uiComponents = new Map();
    this.userData = new Map();
  }

  // Generate a form-based UI component
  async generateFormUI(userId, formConfig) {
    const formId = `form-${userId}-${Date.now()}`;
    
    const formHTML = this.createFormHTML(formConfig, formId);
    
    const resource = createUIResource({
      uri: `ui://dynamic/form/${formId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: formHTML
      },
      encoding: 'text'
    });

    this.uiComponents.set(formId, { type: 'form', config: formConfig });
    return resource;
  }

  // Generate a dashboard UI component
  async generateDashboardUI(userId, dashboardConfig) {
    const dashboardId = `dashboard-${userId}-${Date.now()}`;
    
    const dashboardHTML = this.createDashboardHTML(dashboardConfig, dashboardId);
    
    const resource = createUIResource({
      uri: `ui://dynamic/dashboard/${dashboardId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: dashboardHTML
      },
      encoding: 'text'
    });

    this.uiComponents.set(dashboardId, { type: 'dashboard', config: dashboardConfig });
    return resource;
  }

  // Generate a data visualization UI component
  async generateChartUI(userId, chartConfig) {
    const chartId = `chart-${userId}-${Date.now()}`;
    
    const chartHTML = this.createChartHTML(chartConfig, chartId);
    
    const resource = createUIResource({
      uri: `ui://dynamic/chart/${chartId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: chartHTML
      },
      encoding: 'text'
    });

    this.uiComponents.set(chartId, { type: 'chart', config: chartConfig });
    return resource;
  }

  // Create form HTML
  createFormHTML(config, formId) {
    const { title, fields, submitText = 'Submit' } = config;
    
    const fieldsHTML = fields.map(field => {
      const { name, type, label, placeholder, required, options } = field;
      
      if (type === 'select') {
        const optionsHTML = options.map(opt => 
          `<option value="${opt.value}">${opt.label}</option>`
        ).join('');
        return `
          <div class="form-field">
            <label for="${name}">${label}${required ? ' *' : ''}</label>
            <select id="${name}" name="${name}" ${required ? 'required' : ''}>
              <option value="">Select ${label}</option>
              ${optionsHTML}
            </select>
          </div>
        `;
      } else if (type === 'textarea') {
        return `
          <div class="form-field">
            <label for="${name}">${label}${required ? ' *' : ''}</label>
            <textarea id="${name}" name="${name}" placeholder="${placeholder || ''}" ${required ? 'required' : ''}></textarea>
          </div>
        `;
      } else {
        return `
          <div class="form-field">
            <label for="${name}">${label}${required ? ' *' : ''}</label>
            <input type="${type}" id="${name}" name="${name}" placeholder="${placeholder || ''}" ${required ? 'required' : ''}>
          </div>
        `;
      }
    }).join('');

    return `
      <div class="dynamic-form" style="
        padding: 2rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        max-width: 600px;
        margin: 0 auto;
      ">
        <h2 style="margin-bottom: 1.5rem; text-align: center;">${title}</h2>
        
        <form id="${formId}" onsubmit="handleFormSubmit(event, '${formId}')">
          ${fieldsHTML}
          
          <div style="text-align: center; margin-top: 2rem;">
            <button type="submit" style="
              padding: 1rem 2rem;
              border: none;
              border-radius: 8px;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              font-size: 1.1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ">${submitText}</button>
          </div>
        </form>

        <script>
          function handleFormSubmit(event, formId) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
              data[key] = value;
            }
            
            // Send form data to parent
            window.parent.postMessage({
              type: 'form-submit',
              payload: {
                formId: formId,
                data: data
              }
            }, '*');
            
            // Show success message
            alert('Form submitted successfully!');
          }
          
          // Add hover effects
          document.querySelectorAll('button').forEach(button => {
            button.addEventListener('mouseenter', function() {
              this.style.transform = 'translateY(-2px)';
              this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
            });
            
            button.addEventListener('mouseleave', function() {
              this.style.transform = 'translateY(0)';
              this.style.boxShadow = '';
            });
          });
        </script>
        
        <style>
          .form-field {
            margin-bottom: 1.5rem;
          }
          
          .form-field label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
          }
          
          .form-field input,
          .form-field select,
          .form-field textarea {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 1rem;
            transition: border-color 0.2s;
          }
          
          .form-field input:focus,
          .form-field select:focus,
          .form-field textarea:focus {
            outline: none;
            border-color: #10b981;
          }
          
          .form-field textarea {
            min-height: 100px;
            resize: vertical;
          }
        </style>
      </div>
    `;
  }

  // Create dashboard HTML
  createDashboardHTML(config, dashboardId) {
    const { title, widgets = [] } = config;
    
    const widgetsHTML = (widgets || []).map(widget => {
      const { type, title, data, size = 'medium' } = widget;
      
      if (type === 'metric') {
        return `
          <div class="widget metric-widget" style="
            background: rgba(255,255,255,0.1);
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.2);
          ">
            <h3 style="margin-bottom: 0.5rem; font-size: 1.2rem;">${title}</h3>
            <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${data.value}</div>
            <div style="font-size: 0.9rem; opacity: 0.8;">${data.label}</div>
          </div>
        `;
      } else if (type === 'list') {
        const itemsHTML = data.items.map(item => 
          `<li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">${item}</li>`
        ).join('');
        
        return `
          <div class="widget list-widget" style="
            background: rgba(255,255,255,0.1);
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.2);
          ">
            <h3 style="margin-bottom: 1rem; font-size: 1.2rem;">${title}</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${itemsHTML}
            </ul>
          </div>
        `;
      } else if (type === 'chart') {
        // Handle chart widgets - check if data has the expected structure
        let chartData = data;
        
        // If data has value/label structure (from metric widget), convert to chart format
        if (data.value && data.label && !data.values) {
          chartData = {
            values: [parseInt(data.value.replace(/,/g, '')) || 0],
            labels: [data.label]
          };
        }
        
        // Ensure we have the required data structure
        if (!chartData.values || !chartData.labels) {
          chartData = {
            values: [0],
            labels: ['No Data']
          };
        }
        
        return `
          <div class="widget chart-widget" style="
            background: rgba(255,255,255,0.1);
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.2);
          ">
            <h3 style="margin-bottom: 1rem; font-size: 1.2rem;">${title}</h3>
            <div style="height: 200px; display: flex; align-items: end; justify-content: space-around; padding: 1rem;">
              ${chartData.values.map((value, index) => `
                <div style="
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  width: 30px;
                  height: ${(value / Math.max(...chartData.values)) * 150}px;
                  border-radius: 4px;
                  display: flex;
                  align-items: end;
                  justify-content: center;
                  color: white;
                  font-size: 0.8rem;
                  font-weight: bold;
                ">${value}</div>
              `).join('')}
            </div>
            <div style="display: flex; justify-content: space-around; margin-top: 0.5rem;">
              ${chartData.labels.map(label => `
                <div style="font-size: 0.8rem; opacity: 0.8;">${label}</div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }).join('');

    return `
      <div class="dynamic-dashboard" style="
        padding: 2rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        max-width: 800px;
        margin: 0 auto;
      ">
        <h2 style="margin-bottom: 2rem; text-align: center;">${title}</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
          ${widgetsHTML}
        </div>
        
        <div style="text-align: center; margin-top: 2rem;">
          <button onclick="refreshDashboard('${dashboardId}')" style="
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">Refresh Dashboard</button>
        </div>

        <script>
          function refreshDashboard(dashboardId) {
            window.parent.postMessage({
              type: 'dashboard-refresh',
              payload: {
                dashboardId: dashboardId
              }
            }, '*');
          }
        </script>
      </div>
    `;
  }

  // Create chart HTML
  createChartHTML(config, chartId) {
    const { title, type, data, options = {} } = config;
    
    let chartHTML = '';
    
    if (type === 'bar') {
      const maxValue = Math.max(...data.values);
      chartHTML = `
        <div style="height: 300px; display: flex; align-items: end; justify-content: space-around; padding: 1rem;">
          ${data.values.map((value, index) => `
            <div style="
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              width: 40px;
              height: ${(value / maxValue) * 200}px;
              border-radius: 4px;
              display: flex;
              align-items: end;
              justify-content: center;
              color: white;
              font-size: 0.9rem;
              font-weight: bold;
              margin: 0 5px;
            ">${value}</div>
          `).join('')}
        </div>
        <div style="display: flex; justify-content: space-around; margin-top: 1rem;">
          ${data.labels.map(label => `
            <div style="font-size: 0.9rem; opacity: 0.8; text-align: center;">${label}</div>
          `).join('')}
        </div>
      `;
    } else if (type === 'pie') {
      const total = data.values.reduce((sum, val) => sum + val, 0);
      chartHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 300px;">
          <div style="
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: conic-gradient(
              ${data.values.map((value, index) => {
                const percentage = (value / total) * 100;
                const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                return `${colors[index % colors.length]} ${index === 0 ? 0 : data.values.slice(0, index).reduce((sum, val) => sum + (val / total) * 100, 0)}% ${(value / total) * 100 + (index === 0 ? 0 : data.values.slice(0, index).reduce((sum, val) => sum + (val / total) * 100, 0))}%`;
              }).join(', ')}
            );
          "></div>
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; margin-top: 1rem;">
          ${data.labels.map((label, index) => {
            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
            return `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="
                  width: 12px;
                  height: 12px;
                  border-radius: 2px;
                  background: ${colors[index % colors.length]};
                "></div>
                <span style="font-size: 0.9rem;">${label}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="dynamic-chart" style="
        padding: 2rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        max-width: 600px;
        margin: 0 auto;
      ">
        <h2 style="margin-bottom: 1.5rem; text-align: center;">${title}</h2>
        
        ${chartHTML}
        
        <div style="text-align: center; margin-top: 2rem;">
          <button onclick="exportChart('${chartId}')" style="
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">Export Chart</button>
        </div>

        <script>
          function exportChart(chartId) {
            window.parent.postMessage({
              type: 'chart-export',
              payload: {
                chartId: chartId
              }
            }, '*');
          }
        </script>
      </div>
    `;
  }

  // Store user data
  storeUserData(userId, data) {
    this.userData.set(userId, data);
  }

  // Get user data
  getUserData(userId) {
    return this.userData.get(userId);
  }

  // Get component info
  getComponentInfo(componentId) {
    return this.uiComponents.get(componentId);
  }
} 