import { useModelState, createRender } from "@anywidget/react";
import App from "./components/App";

function Widget() {
  let [count, setCount] = useModelState<number>("count");
  return (
    <div style={{ 
      width: '100%', 
      height: '800px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <App />
    </div>
  );
}

export default {
  render: createRender(Widget)
};