# Công thức tính tổng số lượng point trong 1 box

```bash
pointLocal = inverse(matrixWorld của box) × matrixWorld của point cloud × point
```
---
Point được tính là nằm trong cuboid khi:
``` bash
  |pointLocal.x| ≤ 0.5
  |pointLocal.y| ≤ 0.5
  |pointLocal.z| ≤ 0.5
```

