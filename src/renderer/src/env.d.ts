/// <reference types="vite/client" />

interface Window {
    electron: {
        ipcRenderer: {
            on: (channel: string, func: (...args: any[]) => void) => () => void;
            once: (channel: string, func: (...args: any[]) => void) => void;
            removeListener: (channel: string, func: (...args: any[]) => void) => void;
            invoke: (channel: string, ...args: any[]) => Promise<any>;
        };
    };
}

declare module '*.png' {
    const value: string;
    export default value;
}

declare module '*.jpg' {
    const value: string;
    export default value;
}

declare module '*.svg' {
    const value: string;
    export default value;
}
