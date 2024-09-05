import { Component, Input, AfterViewInit } from '@angular/core';
import { Chart, ChartType, ChartConfiguration } from 'chart.js';
import { DataService } from '../data.service';
import { Colors } from './chartInfo';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css'],
})
export class ChartComponent implements AfterViewInit {
  @Input() chartProps: any; // Properties of the chart passed in

  data = [];
  labels = [];
  title = '';
  chartId: string = Math.random().toString();

  constructor(private dataService: DataService) {}

  async ngAfterViewInit() {
    let props = {
      /* Only for testing */
      /*
title: 'Homes list vs sale',
query: 'select * from homes_sold  limit 5',
key: 'address',
values: ['list_price', 'sale_price'],
chartType: 'line' as ChartType,
*/
title: 'Sales by film category',
       query: 'select * from sales_by_film_category limit 5',
       key: 'category',
       values: ['total_sales'],
       chartType: 'pie' as ChartType,
    };

      if (this.chartProps) {
        props = this.chartProps;
      }

      await this.getData(props.query, props.key, props.values);
      const chartEl = (<HTMLCanvasElement>(
        document.getElementById(this.chartId)
      )) as any;

      const colors = Colors.PastelOne9;

      const datasets = [];
      for (let ii = 0; ii < this.data.length; ii++) {
        const dataset = {
          label: props.values[ii],
          data: this.data[ii],
          borderColor: colors[ii],
          backgroundColor: colors[ii],
          borderWidth: 3,
          fill: false,
        };
        datasets.push(dataset);
      }

      const options: ChartConfiguration['options'] = {};

      switch (props.chartType) {
        case 'line': {
          // [false, 'origin', 'start', 'end'
          options.scales = {
            y: {
              beginAtZero: true,
            },
          };
          break;
        }
        case 'doughnut':
          case 'pie':
          datasets[0].backgroundColor = colors;
        datasets[0].borderColor = ['gray'];
        datasets[0].borderWidth = 1;
        break;
        default: {
          break;
        }
      }

      const ctx = chartEl.getContext('2d');
      new Chart(ctx, {
        type: props.chartType,
        data: {
          labels: this.labels,
          datasets: datasets,
        },
        options: options,
      });
    }

    async getData(query: string, key:any , values:any ) {
      const result = (await this.dataService.doSqlSync(query)) as any;
      // Create an empty array for each value
      for (let kk = 0; kk < values.length; kk++) {
        this.data.push([]);
      }

      // For each row
      for (let ii = 0; ii < result.length; ii++) {
        const row = result[ii];
        this.labels.push(row[key]);
        // for each column in a row
        for (let jj = 0; jj < values.length; jj++) {
          this.data[jj].push(row[values[jj]]);
        }
      }
    }
  }
