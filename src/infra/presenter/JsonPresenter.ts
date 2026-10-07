import Presenter from "../../application/presenter/Presenter";

export default class JsonPresenter<T> implements Presenter<T> {

	present(output: T): T {
		return output;
	}

}
