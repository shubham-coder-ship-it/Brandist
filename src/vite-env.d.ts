/// <reference types="vite/client" />

// Allow importing CSS files with the ?url suffix
declare module "*.css?url" {
    const url: string;
    export default url;
}
