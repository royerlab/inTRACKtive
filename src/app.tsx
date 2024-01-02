import { Component } from 'preact';
import './app.css'
import Scene from './scene.tsx'

const aspectRatio = 4 / 3;

interface AppState {
    windowWidth?: number;
    renderWidth?: number;
}

class App extends Component {
    state: AppState;

    constructor() {
        super();
        const windowWidth = window.innerWidth;
        this.state = {
            windowWidth: windowWidth,
            renderWidth: this.calculateRenderWidth(windowWidth)
        };
    }

    calculateRenderWidth(windowWidth: number) {
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
        return w - appPadding * 2;
    }

    componentDidMount() {
        const handleWindowResize = this.handleWindowResize.bind(this);
        window.addEventListener('resize', handleWindowResize);
    }

    handleWindowResize() {
        const windowWidth = window.innerWidth;
        this.setState({
            windowWidth: windowWidth,
            renderWidth: this.calculateRenderWidth(windowWidth),
        });
    }

    render() {
        const { renderWidth } = this.state;
        const renderHeight = renderWidth ? renderWidth / aspectRatio : 800;
        return (
            <>
                <Scene renderWidth={renderWidth} renderHeight={renderHeight} />
            </>
        )
    }
}

export default App;
