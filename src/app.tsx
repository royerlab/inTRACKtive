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
        if (windowWidth < 800) {
            return windowWidth;
        } else if (windowWidth < 1200) {
            return 800;
        } else if (windowWidth < 1600) {
            return 1024;
        } else {
            return 1200;
        }
    }

    componentDidMount() {
        const handleWindowResize = this.handleWindowResize.bind(this);
        window.addEventListener('resize', handleWindowResize);
    }

    handleWindowResize() {
        const windowWidth = window.innerWidth;
        this.setState({
            windowWidth: windowWidth,
            // TODO: 64 is a magic value based on the CSS padding
            renderWidth: this.calculateRenderWidth(windowWidth) - 64,
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
