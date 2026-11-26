import { handle } from '../shared/http';
import { getWiseCurrencies, postWiseQuote } from '../services/integrations';

export const getWiseCurrenciesHandler = handle(() => getWiseCurrencies());

export const postWiseQuoteHandler = handle((req) => postWiseQuote(req.body));
