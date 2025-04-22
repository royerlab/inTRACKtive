import { useModelState, createRender } from "@anywidget/react";
import App from "./components/App";

function Widget() {
  let [count, setCount] = useModelState<number>("count");
  console.log(count)
  return <App />;
}

export default {
  render: createRender(Widget)
};