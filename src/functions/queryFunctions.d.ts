/**
 * Query function for Google Cloud Run API
 * @param {Object} options - Query configuration
 * @param {string} [options.prj="magnetic-runway-428121"] - Project ID
 * @param {string} [options.ds="schools"] - Dataset ID
 * @param {string} [options.tbl=""] - Table name
 * @param {string} [options.select="*"] - Fields to select
 * @param {string[]} [options.conditions=[]] - Query conditions
 * @returns {Promise<Array<Object>>} Promise containing query results
 */
export function anyQuery({ prj, ds, tbl, select, conditions }?: {
    prj?: string;
    ds?: string;
    tbl?: string;
    select?: string;
    conditions?: string[];
}): Promise<Array<Object>>;
declare namespace _default {
    export { anyQuery };
}
export default _default;