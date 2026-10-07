import Usecase from "../../application/usecase/Usecase";
import HttpServer from "./HttpServer";

export default class InvoicesController {

	constructor (readonly httpServer: HttpServer, readonly usecase: Usecase) {
		httpServer.on("get", "/invoices", async function (params: any, body: any, headers: any, query: any) {
			return usecase.execute({
				month: Number(query.month),
				year: Number(query.year),
				type: query.type,
				format: query.format
			});
		});
	}
}
