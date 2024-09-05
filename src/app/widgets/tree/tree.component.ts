import { Component, Input, OnChanges, AfterViewInit } from '@angular/core';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
  MatTreeFlatDataSource,
  MatTreeFlattener,
} from '@angular/material/tree';

/*
 * @title Tree widget
 * A tree widget that is powered from a cdbfly page by a JSON object
 * Adapated from Angular example of flat tree
 */

/**
 * Each node has a name, an optional URL  and an optional list of children.
 */
interface TreeNode {
  name: string;
  fullName: string;
  url?: string;
  children?: TreeNode[];
}

/** Flat node with expandable and level information */
interface FlatNode {
  expandable: boolean;
  name: string;
  fullName: string;
  url?: string;
  level: number;
  current: boolean;
}

/**
 * @title Tree with flat nodes
 */
@Component({
  selector: 'app-tree',
  templateUrl: './tree.component.html',
  styleUrls: ['./tree.component.css'],
})
export class TreeComponent implements OnChanges, AfterViewInit {
  @Input() treeData: any;
  private _transformer = (node: TreeNode, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      fullName: node.fullName,
      url: node.url,
      level: level,
      current: false,
    };
  };

  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    node => node.expandable
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.children
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor() {}

  async ngOnChanges() {
    this.dataSource.data = this.treeData.data;
    const dataNodes = this.treeControl.dataNodes;
    for (let ii = 0; ii < dataNodes.length; ii++) {
      const node = dataNodes[ii];
      if (node.fullName === this.treeData.page) {
        node.current = true;
      } else {
        if (this.treeData.page.startsWith(node.fullName)) {
          this.treeControl.expand(node);
        }
      }
    }
  }

  ngAfterViewInit() {
    if (this.treeData.toggleTop) {
      this.treeControl.toggle(this.treeControl.dataNodes[0]);
    }
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;
}
