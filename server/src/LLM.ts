import { Configuration, OpenAIApi } from 'openai';
import * as fs from 'fs';
const Db = require('./db');
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const db = new Db();
const fname = 'src/llmPrompt.txt';
const background = fs.readFileSync(fname, 'utf-8');

/**
 * The LLM, Long Language Model, class is the main class for the handling the requests to the OpenAI API.
 * It contains the fetch function that calls the OpenAI API.
 * It also contains the shortSchema function that generates an abbreviated description of the tables and columns in ths database.
 */

export class LLM {
  openai = new OpenAIApi(configuration);
  constructor() {}

  /**
   * The fetch function calls the OpenAI API to generate a response to the query.
   * It returns a promise that resolves to the response.
   * @param query
   * @example const result = await fetch('What is the population of the city of London?');
   */
  async fetch(query: string) {
    const schema = await this.shortSchema();
    const fullRequest = schema + background + query;
    console.log('in fetch');
    console.log(fullRequest);
    try {
      const completion = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: fullRequest }],
      });
      /*
       * data: {
       * id: 'cmpl-6XKRMiJZifNtJuP29w34AXw7ZfkX5',
       * object: 'text_completion',
       * created: 1673401416,
       * model: 'text-davinci-003',
       * choices: [ message: { role: 'assistant', content: '\n\nSELECT * FROM film LIMIT 10;' } ],
       * usage: { prompt_tokens: 254, completion_tokens: 23, total_tokens: 277 }
       * }
       */

      /**
       * We need to do some validation of the response in here.
       * We've asked the model to provide a JSON string that contains the SQL.
       * If the response is not valid JSON, we need to return an error.
       */
      const response = completion.data.choices[0].message['content'];
      const parsed = JSON.parse(response);
      console.log('response', response);

      return completion.data;
    } catch (error) {
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
      } else {
        console.log(error.message);
      }
    }
  }

  /*
   * The shortSchema function generates an abbreviated description of the tables and columns in ths database.
   * It also includes foreign key constraints in the descriptions. The following is an eample of the output for the city table.
   * city (city_id, city, country_id, last_update constr (fkey (country_id) refer pagila(country_pkey))
   * The function returns a promise that resolves to an string containing the abbreviated descriptions.
   */

  async shortSchema() {
    const tableQuery = `
			SELECT c.table_name, c.column_name, c.data_type, fk.constraint_name, fk.unique_constraint_name, fk.unique_constraint_catalog, tc.table_name as target_table_name, ccu.column_name as target_column_name
			FROM information_schema.columns c
			LEFT JOIN information_schema.key_column_usage kcu
				ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
			LEFT OUTER JOIN information_schema.referential_constraints fk
				ON kcu.constraint_name = fk.constraint_name
			LEFT OUTER JOIN information_schema.table_constraints tc
				ON fk.unique_constraint_name = tc.constraint_name
			LEFT OUTER JOIN information_schema.key_column_usage kcu2
				ON tc.constraint_name = kcu2.constraint_name
			LEFT OUTER JOIN information_schema.columns ccu
				ON tc.table_name = ccu.table_name AND kcu2.column_name = ccu.column_name
			WHERE c.table_schema = 'public'
			ORDER BY c.table_name, c.ordinal_position;
		`;

    const rows = await db.runQuery(tableQuery, 'anon');

    let currentTable = '';
    let currentDescription = '';
    let currentConstraints = '';
    const descriptions: string[] = [];

    // loop through the rows where each row represents a database column and build the descriptions
    for (let row of rows) {
      const tableName = row.table_name;
      const columnName = row.column_name;
      const dataType = row.data_type;
      const constraintName = row.constraint_name;
      const uniqueConstraintName = row.target_column_name;
      const uniqueConstraintTable = row.target_table_name;

      // if we are on a new table, then add the description for the previous table to
      // the descriptions array
      if (tableName !== currentTable) {
        if (currentTable !== '') {
          if (currentConstraints !== '') {
            currentDescription += ` ${currentConstraints}`;
          }
          descriptions.push(currentDescription);
        }
        currentTable = tableName;
        currentDescription = `${tableName} `;
        currentConstraints = '';
      } else {
        currentDescription += ',';
      }

      currentDescription += `${columnName}`;

      // if the column is a foreign key, then add the constraint to the currentConstraints string
      if (constraintName) {
        currentConstraints += ` ${columnName} refer ${uniqueConstraintTable}(${uniqueConstraintName})`;
      }
    }

    if (currentConstraints !== '') {
      currentDescription += ` ${currentConstraints}`;
    }
    descriptions.push(currentDescription);

    return descriptions.join('\n');
  }
}
