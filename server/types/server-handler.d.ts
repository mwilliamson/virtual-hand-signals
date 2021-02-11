declare module "serve-handler" {
    import http from "http";

    interface Options {
        cleanUrls?: boolean;
    }
    const serveHandler: (request: http.IncomingMessage, response: http.ServerResponse, options: Options) => void;
    export = serveHandler;
}
