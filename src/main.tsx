import { createRoot } from 'react-dom/client'
import App from './app.tsx'
import './index.css'

const domNode = document.getElementById('app')!
const root = createRoot(domNode);
root.render(<App />);
