import { createUIResource } from '@mcp-ui/server';

export async function createMCPUIExample(input) {
  const resource = createUIResource({
    uri: 'ui://example/interactive-demo',
    content: { 
      type: 'rawHtml', 
      htmlString: `
        <div style="
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          max-width: 500px;
          margin: 0 auto;
        ">
          <h2 style="margin-bottom: 1.5rem; text-align: center;">🎨 MCP UI Demo</h2>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Color Theme:
            </label>
            <select id="theme-select" style="
              width: 100%;
              padding: 0.75rem;
              border: 2px solid rgba(255,255,255,0.3);
              border-radius: 8px;
              background: rgba(255,255,255,0.1);
              color: white;
              font-size: 1rem;
            ">
              <option value="light">Light Theme</option>
              <option value="dark">Dark Theme</option>
              <option value="blue">Blue Theme</option>
              <option value="green">Green Theme</option>
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Font Size:
            </label>
            <input type="range" id="font-size" min="12" max="24" value="16" style="
              width: 100%;
              height: 6px;
              border-radius: 3px;
              background: rgba(255,255,255,0.3);
              outline: none;
            ">
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.9rem;">
              Size: <span id="font-size-value">16px</span>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Animation Speed:
            </label>
            <div style="display: flex; gap: 0.5rem;">
              <button onclick="postMessage({ type: 'tool', payload: { toolName: 'setAnimationSpeed', params: { speed: 'slow' }}})" style="
                flex: 1;
                padding: 0.5rem;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                cursor: pointer;
                transition: all 0.2s;
              ">Slow</button>
              <button onclick="postMessage({ type: 'tool', payload: { toolName: 'setAnimationSpeed', params: { speed: 'normal' }}})" style="
                flex: 1;
                padding: 0.5rem;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                cursor: pointer;
                transition: all 0.2s;
              ">Normal</button>
              <button onclick="postMessage({ type: 'tool', payload: { toolName: 'setAnimationSpeed', params: { speed: 'fast' }}})" style="
                flex: 1;
                padding: 0.5rem;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                cursor: pointer;
                transition: all 0.2s;
              ">Fast</button>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
              Notifications:
            </label>
            <div style="display: flex; gap: 0.5rem;">
              <button onclick="postMessage({ type: 'notify', payload: { message: 'This is an info notification!' }})" style="
                flex: 1;
                padding: 0.75rem;
                border: none;
                border-radius: 6px;
                background: #3b82f6;
                color: white;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
              ">Info</button>
              <button onclick="postMessage({ type: 'notify', payload: { message: 'This is a success notification!' }})" style="
                flex: 1;
                padding: 0.75rem;
                border: none;
                border-radius: 6px;
                background: #10b981;
                color: white;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
              ">Success</button>
              <button onclick="postMessage({ type: 'notify', payload: { message: 'This is a warning notification!' }})" style="
                flex: 1;
                padding: 0.75rem;
                border: none;
                border-radius: 6px;
                background: #f59e0b;
                color: white;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
              ">Warning</button>
            </div>
          </div>

          <div style="text-align: center;">
            <button onclick="postMessage({ type: 'tool', payload: { toolName: 'applySettings', params: { theme: document.getElementById('theme-select').value, fontSize: document.getElementById('font-size').value }}})" style="
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
            ">Apply Settings</button>
          </div>

          <script>
            // Update font size display
            document.getElementById('font-size').addEventListener('input', function() {
              document.getElementById('font-size-value').textContent = this.value + 'px';
            });

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
        </div>
      `
    },
    encoding: 'text'
  });

  return resource;
} 