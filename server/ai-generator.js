import { randomUUID } from 'node:crypto'
import {
  createFormHTML,
  createDashboardHTML,
  createChartHTML,
} from './dynamic-ui-html.js'
import { buildStructuredEnvelope } from './mcp-structured-ui.js'
import { assertGeneratedHtmlWithinLimit } from './generated-html-limit.js'

// AI-Powered Code Generator
export class AIGenerator {
  constructor() {
    this.componentTemplates = new Map();
    this.initializeTemplates();
  }

  // Simple UI Resource creator to replace @mcp-ui/server dependency
  createUIResource({ uri, content, encoding = 'text' }) {
    return {
      uri,
      mimeType: 'text/html',
      text: content.htmlString,
      encoding
    };
  }

  // Initialize component templates
  initializeTemplates() {
    this.componentTemplates.set('form', {
      description: 'A form component with customizable fields',
      generate: this.generateFormFromDescription.bind(this)
    });

    this.componentTemplates.set('dashboard', {
      description: 'A dashboard with widgets and metrics',
      generate: this.generateDashboardFromDescription.bind(this)
    });

    this.componentTemplates.set('chart', {
      description: 'A data visualization chart',
      generate: this.generateChartFromDescription.bind(this)
    });

    this.componentTemplates.set('custom', {
      description: 'A custom HTML component',
      generate: this.generateCustomFromDescription.bind(this)
    });
  }

  // Parse natural language description and extract component requirements
  parseDescription(description) {
    const requirements = {
      type: 'form',
      title: 'Generated Component',
      fields: [],
      widgets: [],
      data: {},
      styling: {},
      interactions: []
    };

    const lowerDesc = description.toLowerCase();

    // Determine component type
    if (lowerDesc.includes('form') || lowerDesc.includes('input') || lowerDesc.includes('submit')) {
      requirements.type = 'form';
      this.extractFormRequirements(description, requirements);
    } else if (lowerDesc.includes('dashboard') || lowerDesc.includes('widget') || lowerDesc.includes('metric')) {
      requirements.type = 'dashboard';
      this.extractDashboardRequirements(description, requirements);
    } else if (lowerDesc.includes('chart') || lowerDesc.includes('graph') || lowerDesc.includes('visualization')) {
      requirements.type = 'chart';
      this.extractChartRequirements(description, requirements);
    } else {
      requirements.type = 'custom';
      this.extractCustomRequirements(description, requirements);
    }

    return requirements;
  }

  // Extract form requirements from description
  extractFormRequirements(description, requirements) {
    const lowerDesc = description.toLowerCase();
    
    // Extract title
    const titleMatch = description.match(/title[:\s]+([^,.\n]+)/i);
    if (titleMatch) {
      requirements.title = titleMatch[1].trim();
    }

    // Extract fields based on keywords
    const fieldKeywords = {
      'name': { type: 'text', label: 'Full Name', required: true },
      'email': { type: 'email', label: 'Email Address', required: true },
      'phone': { type: 'tel', label: 'Phone Number', required: false },
      'message': { type: 'textarea', label: 'Message', required: false },
      'age': { type: 'number', label: 'Age', required: false },
      'gender': { type: 'select', label: 'Gender', options: ['Male', 'Female', 'Other'], required: false },
      'country': { type: 'select', label: 'Country', options: ['USA', 'Canada', 'UK', 'Other'], required: false },
      'subject': { type: 'text', label: 'Subject', required: true },
      'company': { type: 'text', label: 'Company', required: false },
      'website': { type: 'url', label: 'Website', required: false }
    };

    Object.entries(fieldKeywords).forEach(([keyword, fieldConfig]) => {
      if (lowerDesc.includes(keyword)) {
        requirements.fields.push({
          name: keyword,
          ...fieldConfig
        });
      }
    });

    // If no specific fields found, add default fields
    if (requirements.fields.length === 0) {
      requirements.fields = [
        { name: 'name', type: 'text', label: 'Full Name', required: true },
        { name: 'email', type: 'email', label: 'Email Address', required: true },
        { name: 'message', type: 'textarea', label: 'Message', required: false }
      ];
    }
  }

  // Extract dashboard requirements from description
  extractDashboardRequirements(description, requirements) {
    const lowerDesc = description.toLowerCase();
    
    // Extract title
    const titleMatch = description.match(/title[:\s]+([^,.\n]+)/i);
    if (titleMatch) {
      requirements.title = titleMatch[1].trim();
    }

    // Extract widgets based on keywords
    const widgetKeywords = {
      'user': { type: 'metric', title: 'Total Users', data: { value: '1,234', label: 'Active users' } },
      'sales': { type: 'metric', title: 'Total Sales', data: { value: '$45,678', label: 'This month' } },
      'revenue': { type: 'metric', title: 'Revenue', data: { value: '$12,345', label: 'This week' } },
      'activity': { type: 'list', title: 'Recent Activities', data: { items: ['User login', 'Data update', 'Report generated'] } },
      'chart': { type: 'chart', title: 'Sales Chart', data: { values: [100, 150, 200, 175], labels: ['Q1', 'Q2', 'Q3', 'Q4'] } }
    };

    Object.entries(widgetKeywords).forEach(([keyword, widgetConfig]) => {
      if (lowerDesc.includes(keyword)) {
        requirements.widgets.push(widgetConfig);
      }
    });

    // If no specific widgets found, add default widgets
    if (requirements.widgets.length === 0) {
      requirements.widgets = [
        { type: 'metric', title: 'Total Users', data: { value: '1,234', label: 'Active users' } },
        { type: 'list', title: 'Recent Activities', data: { items: ['User login', 'Data update', 'Report generated'] } }
      ];
    }
  }

  // Extract chart requirements from description
  extractChartRequirements(description, requirements) {
    const lowerDesc = description.toLowerCase();
    
    // Extract title
    const titleMatch = description.match(/title[:\s]+([^,.\n]+)/i);
    if (titleMatch) {
      requirements.title = titleMatch[1].trim();
    }

    // Determine chart type
    if (lowerDesc.includes('pie') || lowerDesc.includes('circle')) {
      requirements.data.type = 'pie';
    } else {
      requirements.data.type = 'bar';
    }

    // Extract data based on keywords
    if (lowerDesc.includes('sales') || lowerDesc.includes('revenue')) {
      requirements.data.values = [120, 150, 180, 200, 175];
      requirements.data.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
    } else if (lowerDesc.includes('user') || lowerDesc.includes('traffic')) {
      requirements.data.values = [100, 120, 140, 160, 180];
      requirements.data.labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    } else {
      requirements.data.values = [50, 75, 100, 125, 150];
      requirements.data.labels = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
    }
  }

  // Extract custom component requirements
  extractCustomRequirements(description, requirements) {
    const lowerDesc = description.toLowerCase();
    
    // Extract title
    const titleMatch = description.match(/title[:\s]+([^,.\n]+)/i);
    if (titleMatch) {
      requirements.title = titleMatch[1].trim();
    }

    // Generate custom HTML based on description
    requirements.html = this.generateCustomHTML(description);
  }

  // Generate custom HTML based on description
  generateCustomHTML(description) {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('card') || lowerDesc.includes('profile')) {
      return `
        <div style="
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          max-width: 400px;
          margin: 0 auto;
        ">
          <div style="text-align: center;">
            <div style="
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: rgba(255,255,255,0.2);
              margin: 0 auto 1rem;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
            ">👤</div>
            <h2 style="margin-bottom: 0.5rem;">John Doe</h2>
            <p style="margin-bottom: 1rem; opacity: 0.8;">Software Developer</p>
            <div style="
              display: flex;
              justify-content: space-around;
              margin-top: 1.5rem;
            ">
              <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold;">150</div>
                <div style="font-size: 0.9rem; opacity: 0.8;">Projects</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold;">5+</div>
                <div style="font-size: 0.9rem; opacity: 0.8;">Years</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold;">4.9</div>
                <div style="font-size: 0.9rem; opacity: 0.8;">Rating</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (lowerDesc.includes('button') || lowerDesc.includes('cta')) {
      return `
        <div style="
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          text-align: center;
        ">
          <h2 style="margin-bottom: 1rem;">Call to Action</h2>
          <p style="margin-bottom: 2rem; opacity: 0.9;">Ready to get started? Click the button below!</p>
          <button onclick="alert('Button clicked!')" style="
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
          ">Get Started</button>
        </div>
      `;
    } else {
      return `
        <div style="
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          text-align: center;
        ">
          <h2 style="margin-bottom: 1rem;">Custom Component</h2>
          <p style="margin-bottom: 1rem; opacity: 0.9;">This is a custom component generated based on your description.</p>
          <div style="
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-top: 1.5rem;
          ">
            <button onclick="alert('Action 1')" style="
              padding: 0.75rem 1.5rem;
              border: none;
              border-radius: 6px;
              background: rgba(255,255,255,0.2);
              color: white;
              cursor: pointer;
            ">Action 1</button>
            <button onclick="alert('Action 2')" style="
              padding: 0.75rem 1.5rem;
              border: none;
              border-radius: 6px;
              background: rgba(255,255,255,0.2);
              color: white;
              cursor: pointer;
            ">Action 2</button>
          </div>
        </div>
      `;
    }
  }

  // Generate component from AI description
  async generateFromDescription(userId, description) {
    try {
      console.log('AI Generating component from description:', description);
      
      const requirements = this.parseDescription(description);
      const componentId = `ai-${userId}-${randomUUID()}`;
      
      let resource;
      
      switch (requirements.type) {
        case 'form':
          resource = await this.generateFormFromDescription(requirements, componentId);
          break;
        case 'dashboard':
          resource = await this.generateDashboardFromDescription(requirements, componentId);
          break;
        case 'chart':
          resource = await this.generateChartFromDescription(requirements, componentId);
          break;
        case 'custom':
          resource = await this.generateCustomFromDescription(requirements, componentId);
          break;
        default:
          throw new Error('Unknown component type');
      }
      
      return resource;
    } catch (error) {
      console.error('AI Generation error:', error);
      throw error;
    }
  }

  // Generate form from AI requirements
  async generateFormFromDescription(requirements, componentId) {
    const formConfig = {
      title: requirements.title,
      fields: requirements.fields,
      submitText: 'Submit'
    };

    const formHTML = createFormHTML(formConfig, componentId);
    assertGeneratedHtmlWithinLimit(formHTML);

    const resource = this.createUIResource({
      uri: `ui://ai/form/${componentId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: formHTML
      },
      encoding: 'text'
    });

    return {
      ...resource,
      structured: buildStructuredEnvelope('form', componentId, formConfig),
    };
  }

  // Generate dashboard from AI requirements
  async generateDashboardFromDescription(requirements, componentId) {
    const dashboardConfig = {
      title: requirements.title,
      widgets: requirements.widgets
    };

    const dashboardHTML = createDashboardHTML(dashboardConfig, componentId);
    assertGeneratedHtmlWithinLimit(dashboardHTML);

    const resource = this.createUIResource({
      uri: `ui://ai/dashboard/${componentId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: dashboardHTML
      },
      encoding: 'text'
    });

    return {
      ...resource,
      structured: buildStructuredEnvelope('dashboard', componentId, dashboardConfig),
    };
  }

  // Generate chart from AI requirements
  async generateChartFromDescription(requirements, componentId) {
    const chartConfig = {
      title: requirements.title,
      type: requirements.data.type,
      data: requirements.data
    };

    const chartHTML = createChartHTML(chartConfig, componentId);
    assertGeneratedHtmlWithinLimit(chartHTML);

    const resource = this.createUIResource({
      uri: `ui://ai/chart/${componentId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: chartHTML
      },
      encoding: 'text'
    });

    return {
      ...resource,
      structured: buildStructuredEnvelope('chart', componentId, chartConfig),
    };
  }

  // Generate custom component from AI requirements
  async generateCustomFromDescription(requirements, componentId) {
    assertGeneratedHtmlWithinLimit(requirements.html);

    const resource = this.createUIResource({
      uri: `ui://ai/custom/${componentId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: requirements.html
      },
      encoding: 'text'
    });

    return resource;
  }

  // Get suggestions based on description
  getSuggestions(description) {
    const suggestions = [];
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('form') || lowerDesc.includes('input')) {
      suggestions.push('Contact form with name, email, and message fields');
      suggestions.push('Registration form with username, password, and confirm password');
      suggestions.push('Survey form with multiple choice questions');
    }
    
    if (lowerDesc.includes('dashboard') || lowerDesc.includes('widget')) {
      suggestions.push('Analytics dashboard with user metrics and charts');
      suggestions.push('Sales dashboard with revenue and conversion metrics');
      suggestions.push('Project management dashboard with tasks and progress');
    }
    
    if (lowerDesc.includes('chart') || lowerDesc.includes('graph')) {
      suggestions.push('Bar chart showing monthly sales data');
      suggestions.push('Pie chart displaying user demographics');
      suggestions.push('Line chart tracking website traffic over time');
    }
    
    if (lowerDesc.includes('card') || lowerDesc.includes('profile')) {
      suggestions.push('User profile card with avatar and stats');
      suggestions.push('Product card with image, title, and price');
      suggestions.push('Team member card with role and contact info');
    }
    
    return suggestions;
  }

} 