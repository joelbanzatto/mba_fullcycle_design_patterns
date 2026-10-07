import InvoiceOutput from "../dto/InvoiceOutput";
import Presenter from "./Presenter";

export default interface PresenterFactory {
	create (format?: string): Presenter<InvoiceOutput[]>;
}
