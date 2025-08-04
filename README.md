# Dynamic MCP UI Generator

A comprehensive full-stack application that demonstrates the power of MCP (Model Context Protocol) UI components with dynamic generation capabilities. This application allows users to create, customize, and generate interactive UI components through a sophisticated MCP server with a modern glassmorphism design.

## 🚀 Features

### Core MCP UI Components
- **Dynamic UI Generation**: Create custom forms, dashboards, and charts on-the-fly
- **Real-time Communication**: PostMessage API integration for seamless parent-child communication
- **Notification System**: Toast notifications for user feedback and system events
- **Modern Glassmorphism Design**: Beautiful glass-like UI with backdrop blur effects

### Dynamic UI Generation
- **Form Builder**: Create custom forms with various field types (text, email, number, select, textarea)
- **Dashboard Builder**: Generate analytics dashboards with metrics, lists, and charts
- **Chart Builder**: Create bar charts and pie charts with custom data
- **Real-time Preview**: See generated components immediately after creation

### Advanced MCP Server Features
- **Component Management**: Track and manage generated UI components
- **User Data Storage**: Store and retrieve user-specific data
- **Dynamic HTML Generation**: Server-side HTML generation with embedded JavaScript
- **Responsive Design**: All generated components are mobile-friendly

### Modern Design System
- **Glassmorphism**: Translucent glass-like components with backdrop blur
- **Animated Background**: Subtle animated gradient background
- **Modern Typography**: Inter font family for clean, readable text
- **Smooth Animations**: Fluid transitions and hover effects
- **Responsive Layout**: Optimized for all device sizes

## 🏗️ Project Structure

```
mcp-ui-poc/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main React component with UI builders
│   │   ├── App.css        # Modern glassmorphism styling
│   │   ├── index.css      # Global styles and utilities
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

## 🛠️ Installation

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

## 📊 API Endpoints

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

## 🎨 UI Components

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

## 🎨 Design System

### Glassmorphism Components
- **Translucent Backgrounds**: Semi-transparent glass-like surfaces
- **Backdrop Blur**: Modern blur effects for depth
- **Subtle Borders**: Light borders for definition
- **Soft Shadows**: Layered shadow system for depth

### Color Palette
- **Primary Gradient**: Purple to blue gradient (#667eea to #764ba2)
- **Success Gradient**: Blue to cyan (#4facfe to #00f2fe)
- **Warning Gradient**: Green to teal (#43e97b to #38f9d7)
- **Danger Gradient**: Pink to yellow (#fa709a to #fee140)

### Typography
- **Font Family**: Inter (Google Fonts)
- **Font Weights**: 300, 400, 500, 600, 700
- **Responsive**: Fluid typography scaling

### Animations
- **Smooth Transitions**: 0.3s cubic-bezier easing
- **Hover Effects**: Subtle lift and glow effects
- **Loading States**: Pulse animations for feedback
- **Background Animation**: Subtle gradient shifts

## 🔧 Technologies Used

### Frontend
- **React 18**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **CSS3**: Advanced styling with glassmorphism effects
- **Inter Font**: Modern, readable typography

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework for API endpoints
- **CORS**: Cross-origin resource sharing
- **@mcp-ui/server**: MCP UI server SDK

### Development Tools
- **Nodemon**: Automatic server restart on file changes
- **ES6 Modules**: Modern JavaScript module system

## 🚀 Scripts

### Development
- `npm run dev` - Start backend server with nodemon
- `npm run client` - Start frontend development server
- `npm run build` - Build frontend for production

### Installation
- `npm run install-all` - Install both frontend and backend dependencies
- `npm run install-client` - Install only frontend dependencies
- `npm run install-server` - Install only backend dependencies

## 🎯 Usage Examples

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

## 🔄 Real-time Features

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

## 🎨 Styling and Design

### Modern UI Design
- **Glassmorphism**: Translucent glass-like components
- **Animated Background**: Subtle gradient animations
- **Responsive Design**: Works on all screen sizes
- **Interactive Elements**: Hover effects and transitions

### Component Styling
- **Custom CSS Variables**: Consistent design tokens
- **Grid-based Layouts**: Flexible field management
- **Toast Notifications**: Different types with animations
- **Tab Navigation**: Active states with smooth transitions

## 🔒 Security and Best Practices

### Data Handling
- User data is stored securely on the server
- Form submissions are validated and sanitized
- API endpoints include proper error handling

### Component Isolation
- Generated components run in isolated iframes
- PostMessage API ensures secure communication
- No cross-site scripting vulnerabilities

### Accessibility
- **Focus States**: Clear focus indicators
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects user motion preferences
- **Screen Reader**: Proper ARIA labels and structure

## 🚀 Future Enhancements

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

### Design Enhancements
- **Dark/Light Mode**: Theme switching capability
- **Custom Themes**: User-defined color schemes
- **Animation Library**: Advanced motion design
- **Micro-interactions**: Delightful user experience details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ using React, Node.js, and MCP UI technology with modern glassmorphism design** 