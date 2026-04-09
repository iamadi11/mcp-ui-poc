# Dynamic MCP UI Generator

Full-stack demo for MCP (Model Context Protocol) UI: build forms, dashboards, and charts in the browser, backed by a Node server that returns MCP UI resources. The client is intentionally **minimal**—neutral surfaces, a single accent color, and **light/dark styling from the system** (`prefers-color-scheme`), not decorative gradients or heavy effects.

## Features

### Core MCP UI
- **Dynamic UI generation**: Forms, dashboards, and charts from configuration
- **PostMessage**: Parent page and generated iframe stay in sync for tools and events
- **Toasts**: Short-lived notifications for submissions and actions

### Builders
- **Form builder**: Text, email, number, select, textarea; required flags and labels
- **Dashboard builder**: Metrics, lists, and chart widgets
- **Chart builder**: Bar and pie charts from comma-separated values and labels
- **Preview**: Generated HTML renders inline after each build

### Server
- **Components & storage**: Track generated components and optional user-scoped data
- **HTML generation**: Server-built HTML/JS for MCP UI payloads
- **Layout**: Generated embeds are responsive

### Interface
- **Typography**: DM Sans, restrained scale
- **Theme**: CSS variables; light and dark follow OS preference
- **Layout**: Narrow content width, clear hierarchy, no animated page background

## Project structure

```
mcp-ui-poc/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main React component with UI builders
│   │   ├── App.css        # Theme tokens and layout
│   │   ├── index.css      # Base reset
│   │   └── main.jsx       # React entry point
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Vite configuration
├── server/                 # Node.js backend
│   ├── index.js           # Express server with API endpoints
│   ├── mcp-server.js      # MCP server for dynamic UI generation
│   └── mcp-ui-example.js  # Static MCP UI example
├── package.json           # Backend dependencies
└── README.md             # Project documentation
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mcp-ui-poc
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run install-all
   ```

3. **Start the development servers**
   ```bash
   # Terminal 1: Start backend server
   npm run dev
   
   # Terminal 2: Start frontend development server
   npm run client
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## API endpoints

### Health Check
- `GET /api/health` - Server status and health information

### MCP UI Components
- `GET /api/mcp-ui-example` - Get the static MCP UI demo component

### Dynamic UI Generation
- `POST /api/generate-form` - Generate a custom form UI
- `POST /api/generate-dashboard` - Generate a dashboard UI
- `POST /api/generate-chart` - Generate a chart UI

### Data Management
- `POST /api/store-data` - Store user data
- `GET /api/get-data/:userId` - Retrieve user data
- `GET /api/component-info/:componentId` - Get component information

## Builder reference

### Form Builder
Create dynamic forms with:
- **Field Types**: Text, email, number, select dropdown, textarea
- **Validation**: Required field support
- **Customization**: Placeholder text, labels, submit button text
- **Real-time Preview**: See form changes immediately

### Dashboard Builder
Generate analytics dashboards with:
- **Metric Widgets**: Display key performance indicators
- **List Widgets**: Show activity feeds and data lists
- **Chart Widgets**: Embedded data visualizations
- **Responsive Layout**: Auto-adjusting grid system

### Chart Builder
Create data visualizations:
- **Bar Charts**: Horizontal bar charts with custom data
- **Pie Charts**: Circular charts with color-coded segments
- **Custom Data**: Input values and labels via comma-separated format
- **Export Functionality**: Chart export capabilities

## Design system

The UI is **token-driven** (`client/src/App.css`): background, surface, border, text, and accent colors adapt when the OS switches between light and dark mode.

- **Surfaces**: Page background vs. elevated cards; 1px borders instead of glass or blur stacks
- **Accent**: One primary interactive color (blue family in light, softer blue in dark)
- **Type**: DM Sans; headings use tight letter-spacing and weight, not gradient text
- **Motion**: Short transitions on hovers and focus; connection status may pulse lightly; respect `prefers-reduced-motion`
- **Components**: Segmented tabs, flat primary buttons, secondary actions as outline or muted fills

## Technologies

### Frontend
- **React 18**: Hooks and functional components
- **Vite**: Dev server and production build
- **CSS**: Custom properties for theming (no UI framework)

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework for API endpoints
- **CORS**: Cross-origin resource sharing
- **@mcp-ui/server**: MCP UI server SDK

### Development Tools
- **Nodemon**: Automatic server restart on file changes
- **ES6 Modules**: Modern JavaScript module system

## Scripts

### Development
- `npm run dev` - Start backend server with nodemon
- `npm run client` - Start frontend development server
- `npm run build` - Build frontend for production

### Installation
- `npm run install-all` - Install both frontend and backend dependencies
- `npm run install-client` - Install only frontend dependencies
- `npm run install-server` - Install only backend dependencies

## Usage

### Creating a Custom Form
1. Navigate to the "Form Builder" tab
2. Set the form title and submit button text
3. Add fields with desired types and validation
4. Click "Generate Form" to create the UI component
5. The generated form will appear below with full functionality

### Building a Dashboard
1. Go to the "Dashboard Builder" tab
2. Configure the dashboard title
3. Add widgets (metrics, lists, charts)
4. Generate the dashboard to see the interactive component

### Creating Charts
1. Select the "Chart Builder" tab
2. Choose chart type (bar or pie)
3. Enter data values and labels
4. Generate the chart for visualization

## Real-time behavior

### Form Submission
- Forms automatically send data to the parent application
- Real-time notifications show submission results
- Data can be stored and retrieved via API

### Dashboard Interactions
- Refresh buttons update dashboard data
- Widget interactions trigger notifications
- Component state is managed by the MCP server

### Chart Export
- Export functionality for generated charts
- Notification system for export events
- Customizable chart appearance and data

## Styling and layout

- **Tokens**: Shared variables for color, radius, and spacing
- **Responsive**: Builders collapse to a single column on small screens; toasts move to the bottom on narrow viewports
- **Feedback**: Focus rings on keyboard focus; selection and scrollbars stay low-contrast

## Security and practices

### Data Handling
- User data is stored securely on the server
- Form submissions are validated and sanitized
- API endpoints include proper error handling

### Component Isolation
- Generated components run in isolated iframes
- PostMessage API ensures secure communication
- No cross-site scripting vulnerabilities

### Accessibility
- **Focus**: Visible `:focus-visible` styles on interactive controls
- **Reduced motion**: Honors `prefers-reduced-motion` for animations
- **Status**: API health uses a live region where applicable

## Future enhancements

### Planned Features
- **More Chart Types**: Line charts, scatter plots, area charts
- **Advanced Form Validation**: Custom validation rules and error messages
- **Component Templates**: Pre-built templates for common use cases
- **Real-time Collaboration**: Multi-user editing and sharing
- **Export Options**: PDF, image, and code export capabilities

### Technical Improvements
- **Database Integration**: Persistent storage for user data
- **Authentication**: User accounts and session management
- **Component Library**: Reusable UI component system
- **Performance Optimization**: Lazy loading and code splitting

### Design enhancements
- **Explicit theme toggle**: Optional in-app override of system light/dark
- **Additional chart types**: Line, area, scatter
- **Export**: PDF or image export for previews

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Stack: React, Vite, Node.js, Express, `@mcp-ui/server`. 