import { useState, useEffect } from 'react';
import './app.css'
import Scene from './scene.tsx'

const aspectRatio = 4 / 3;

export default function App() {
    const [renderWidth, setRenderWidth] = useState(800);

    function handleWindowResize() {
        const windowWidth = window.innerWidth;
        const appPadding = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--app-padding')
        );
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
        let renderWidth = w - appPadding * 2;
        renderWidth = renderWidth < 0 ? windowWidth : renderWidth;
        setRenderWidth(renderWidth);
    }

    useEffect(() => {
        handleWindowResize();
        window.addEventListener('resize', handleWindowResize);
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        }
    }, [renderWidth]);


    return (
        <>
            <Scene renderWidth={renderWidth} renderHeight={renderWidth / aspectRatio} />
        </>
    )

}
