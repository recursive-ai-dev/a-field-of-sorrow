import * as THREE from "three";

export class SpatialGrid<T extends { pos: THREE.Vector3 }> {
  private cellSize: number;
  private grid: Map<string, T[]> = new Map();
  private items: T[] = [];
  private itemToCell: Map<T, string> = new Map();

  constructor(private bounds: { min: THREE.Vector3; max: THREE.Vector3 }, cellSize: number = 20) {
    this.cellSize = cellSize;
  }

  add(item: T): void {
    if (this.items.includes(item)) return;
    this.items.push(item);
    this.updateItem(item);
  }

  updateItem(item: T): void {
    const newKey = this.getCellKey(item.pos);
    const oldKey = this.itemToCell.get(item);

    if (oldKey === newKey) return;

    if (oldKey !== undefined) {
      const cellItems = this.grid.get(oldKey);
      if (cellItems) {
        const index = cellItems.indexOf(item);
        if (index !== -1) {
          cellItems.splice(index, 1);
          if (cellItems.length === 0) {
            this.grid.delete(oldKey);
          }
        }
      }
    }

    if (!this.grid.has(newKey)) {
      this.grid.set(newKey, []);
    }
    this.grid.get(newKey)!.push(item);
    this.itemToCell.set(item, newKey);
  }

  remove(item: T): void {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
    }

    const key = this.itemToCell.get(item);
    if (key !== undefined) {
      const cellItems = this.grid.get(key);
      if (cellItems) {
        const index = cellItems.indexOf(item);
        if (index !== -1) {
          cellItems.splice(index, 1);
          if (cellItems.length === 0) {
            this.grid.delete(key);
          }
        }
      }
      this.itemToCell.delete(item);
    }
  }

  clear(): void {
    this.grid.clear();
    this.items = [];
    this.itemToCell.clear();
  }

  queryNearby(position: THREE.Vector3, radius: number): T[] {
    const result: T[] = [];
    const minCell = this.getCellCoordinates(position.clone().subScalar(radius));
    const maxCell = this.getCellCoordinates(position.clone().addScalar(radius));

    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let z = minCell.z; z <= maxCell.z; z++) {
        const key = this.getCellKeyFromCoords(x, z);
        const cellItems = this.grid.get(key);
        if (cellItems) {
          result.push(...cellItems);
        }
      }
    }

    return result;
  }

  queryAll(): T[] {
    return this.items;
  }

  private getCellKey(position: THREE.Vector3): string {
    const coords = this.getCellCoordinates(position);
    return this.getCellKeyFromCoords(coords.x, coords.z);
  }

  private getCellKeyFromCoords(x: number, z: number): string {
    return `${x},${z}`;
  }

  private getCellCoordinates(position: THREE.Vector3): { x: number; z: number } {
    return {
      x: Math.floor((position.x - this.bounds.min.x) / this.cellSize),
      z: Math.floor((position.z - this.bounds.min.z) / this.cellSize)
    };
  }

  getStats(): { cellCount: number; itemCount: number } {
    return {
      cellCount: this.grid.size,
      itemCount: this.items.length
    };
  }
}
