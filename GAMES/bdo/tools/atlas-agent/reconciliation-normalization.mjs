export const CANONICAL_LITERAL_MAPPINGS=Object.freeze({'Сок клена':'Сок клёна','Никелиевая руда':'Никелевая руда'});
export const canonicalLookup=value=>{const v=typeof value==='string'?value.trim():value;return CANONICAL_LITERAL_MAPPINGS[v]??v};
