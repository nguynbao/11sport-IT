import { handle } from '../shared/http';
import { getSystemPrintersList, executeDirectLabelPrint } from '../services/integrations';

export const getPrintersHandler = handle(() => getSystemPrintersList());

export const printLabelsHandler = handle((req) => executeDirectLabelPrint(req.body || {}));
