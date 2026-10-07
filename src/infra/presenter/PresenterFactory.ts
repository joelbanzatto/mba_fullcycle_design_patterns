import InvoiceOutput from "../../application/dto/InvoiceOutput";
import Presenter from "../../application/presenter/Presenter";
import PresenterFactoryPort from "../../application/presenter/PresenterFactory";
import CsvPresenter from "./CsvPresenter";
import JsonPresenter from "./JsonPresenter";

export default class PresenterFactory implements PresenterFactoryPort {

	create (format?: string): Presenter<InvoiceOutput[]> {
		if (format === undefined || format === "json") {
			return new JsonPresenter<InvoiceOutput[]>();
		}
		if (format === "csv") {
			return new CsvPresenter();
		}
		throw new Error("Invalid format");
	}
}
