/**
 * Ready-to-send studio recipes. Each item is a public HTTP JSON API plus a
 * prompt that exercises one data shape the planner already knows.
 */
export const EXAMPLE_KINDS = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'records', label: 'Record list' },
  { id: 'nested', label: 'Nested objects' },
  { id: 'feed', label: 'Content feed' },
  { id: 'series', label: 'Time series' },
  { id: 'object', label: 'Single object' },
  { id: 'tasks', label: 'Task list' },
  { id: 'catalog', label: 'Product catalog' },
  { id: 'embed', label: 'Embed widget' },
]

export const EXAMPLES = [
  {
    id: 'shoe-checkout',
    kind: 'checkout',
    title: 'Shoe checkout',
    blurb: 'No API URL. Demo cart for a shoes store: line items, sizes, and order totals.',
    url: '',
    prompt: 'Create a dashboard for an ecommerce checkout app for shoes',
  },
  {
    id: 'users-dashboard',
    kind: 'records',
    title: 'Users directory',
    blurb: 'Array of people records — stats plus a readable table of names and emails.',
    url: 'https://jsonplaceholder.typicode.com/users',
    prompt: 'Create a dashboard from this API',
  },
  {
    id: 'users-drawer',
    kind: 'nested',
    title: 'Users with nested address',
    blurb: 'Same users payload; Insights drawer surfaces city, company, and geo fields.',
    url: 'https://jsonplaceholder.typicode.com/users',
    prompt: 'Create a dashboard from this API with a drawer for more insights',
  },
  {
    id: 'posts-table',
    kind: 'feed',
    title: 'Posts feed',
    blurb: 'Long-form records with title and body — best as a table.',
    url: 'https://jsonplaceholder.typicode.com/posts',
    prompt: 'Show as a table',
  },
  {
    id: 'comments-dashboard',
    kind: 'feed',
    title: 'Comments thread',
    blurb: 'Name, email, and body columns from a comments endpoint.',
    url: 'https://jsonplaceholder.typicode.com/comments',
    prompt: 'Create a dashboard from this API',
  },
  {
    id: 'todos-list',
    kind: 'tasks',
    title: 'Todos',
    blurb: 'Boolean completed flags on a task list.',
    url: 'https://jsonplaceholder.typicode.com/todos',
    prompt: 'Create a dashboard from this API',
  },
  {
    id: 'weather-series',
    kind: 'series',
    title: 'Hourly temperature',
    blurb: 'Open-Meteo parallel arrays zipped into High/Low stats, a line chart, and records.',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&hourly=temperature_2m',
    prompt: 'Create a dashboard from this API with tooltip and animation',
  },
  {
    id: 'user-one',
    kind: 'object',
    title: 'One user object',
    blurb: 'A single JSON object — key-value details instead of a table.',
    url: 'https://jsonplaceholder.typicode.com/users/1',
    prompt: 'Show the fields from this API',
  },
  {
    id: 'products-catalog',
    kind: 'catalog',
    title: 'Product catalog',
    blurb: 'DummyJSON products with prices — mixed numeric and string fields.',
    url: 'https://dummyjson.com/products',
    prompt: 'Create a dashboard from this API',
  },
  {
    id: 'weather-embed',
    kind: 'embed',
    title: 'Embeddable weather stat',
    blurb: 'One component, no page chrome — for dropping into another host.',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&hourly=temperature_2m',
    prompt: 'Single embeddable component',
  },
]
