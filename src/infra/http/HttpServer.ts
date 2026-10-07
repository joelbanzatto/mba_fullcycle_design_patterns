export default interface HttpServer {
	// Callbacks receive (params, body, headers, query) and return the response payload.
	on (method: string, url: string, callback: Function): void;
	listen (port: number): void;
}
