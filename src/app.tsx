import { Component } from 'react';
import './app.css'
import Scene from './scene.tsx'

const aspectRatio = 4 / 3;

interface AppProps {}

interface AppState {
    renderWidth: number;
}

class App extends Component {
    state: AppState = {
        renderWidth: 800,
    }

    constructor(props: AppProps) {
        super(props);
    }

    calculateRenderWidth() {
        const windowWidth = window.innerWidth;
        const appPadding = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-padding'));
        let w: number;
        if (windowWidth < 800) {
            w = windowWidth;
        } else if (windowWidth < 1200) {
            w = 800;
        } else if (windowWidth < 1600) {
            w = 1024;
        } else {
            w = 1200;
        }
        const renderWidth = w - appPadding * 2;
        return renderWidth < 0 ? windowWidth : renderWidth;
    }

    componentDidMount() {
        const handleWindowResize = this.handleWindowResize.bind(this);
        window.addEventListener('resize', handleWindowResize);
        this.handleWindowResize();
    }

    handleWindowResize() {
        this.setState({
            renderWidth: this.calculateRenderWidth(),
        });
    }

    render() {
        const renderWidth = this.state.renderWidth || 800;
        const renderHeight = renderWidth / aspectRatio;
        return (
            <>
                <Scene renderWidth={renderWidth} renderHeight={renderHeight} />
            </>
        )
    }
}

export default App;
