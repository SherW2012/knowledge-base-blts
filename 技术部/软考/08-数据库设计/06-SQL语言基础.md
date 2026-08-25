# SQL语言基础

## 1. SQL的作用范围

SQL是关系数据库的声明式语言。使用者描述“需要什么结果”，DBMS负责选择具体访问路径。它不仅用于查询，还覆盖结构定义、数据更新、权限和事务控制。

| 类别 | 主要语句 | 作用 |
|---|---|---|
| DDL 数据定义语言 | `CREATE`、`ALTER`、`DROP` | 定义数据库对象和结构 |
| DML 数据操纵语言 | `SELECT`、`INSERT`、`UPDATE`、`DELETE` | 查询和修改数据 |
| DCL 数据控制语言 | `GRANT`、`REVOKE` | 授予和收回权限 |
| TCL 事务控制语言 | `COMMIT`、`ROLLBACK`、`SAVEPOINT` | 控制事务边界 |

不同资料对`SELECT`是否单列为DQL、事务语句如何归类可能略有差异。理解重点是各类语句承担的职责，而不是把一种分类口径当成SQL本身的语义规则。

## 2. 查询的逻辑处理顺序

SQL书写从`SELECT`开始，但理解结果时应按逻辑处理顺序分析：

```text
FROM / JOIN
→ WHERE
→ GROUP BY
→ HAVING
→ SELECT
→ DISTINCT
→ ORDER BY
→ LIMIT / OFFSET
```

这解释了两个常见问题：

- `WHERE`过滤分组前的行，不能直接使用聚合结果；
- `HAVING`过滤分组后的组，可以使用`COUNT`、`SUM`等聚合函数。

```sql
SELECT department_id, COUNT(*) AS employee_count
FROM employee
WHERE active = true
GROUP BY department_id
HAVING COUNT(*) >= 5
ORDER BY employee_count DESC;
```

## 3. 连接查询

```sql
SELECT s.name, c.title, e.score
FROM student AS s
JOIN enrollment AS e ON e.student_id = s.id
JOIN course AS c ON c.id = e.course_id;
```

- `INNER JOIN`只保留两侧匹配行；
- `LEFT JOIN`保留左侧全部行，右侧无匹配时补`NULL`；
- `RIGHT JOIN`与左连接方向相反；
- `FULL OUTER JOIN`保留两侧未匹配行；
- `CROSS JOIN`产生笛卡尔积。

使用外连接时，把右表条件放在`WHERE`中可能过滤掉补出的`NULL`行，使结果退化得接近内连接；如果条件属于匹配规则，通常应放在`ON`中。

## 4. 聚合、分组和空值

常见聚合函数有`COUNT`、`SUM`、`AVG`、`MAX`和`MIN`。

- `COUNT(*)`统计结果行数，包括含空值的行；
- `COUNT(column)`只统计该列非`NULL`的行；
- 多数聚合函数忽略`NULL`；
- `NULL`不能用普通等号判断，应使用`IS NULL`或`IS NOT NULL`。

SQL中的`UNKNOWN`会影响筛选：`WHERE`只保留条件为真的行，条件为假或未知的行都不会返回。

## 5. 子查询与存在性判断

- 标量子查询返回单个值；
- 行子查询返回一行；
- 表子查询返回关系结果；
- 相关子查询引用外层当前行，逻辑上随外层行进行判断。

`EXISTS`只关心子查询是否至少返回一行；`IN`判断值是否属于结果集合。涉及`NULL`时，`NOT IN`可能产生未知结果，`NOT EXISTS`通常更容易表达严格的“不存在”。

## 6. 集合运算

- `UNION`合并结果并消除重复；
- `UNION ALL`保留重复，通常开销更小；
- `INTERSECT`取得交集；
- `EXCEPT`或部分产品中的`MINUS`取得差集。

参与集合运算的查询必须具有相同列数，并且对应列的数据类型兼容。

## 7. 数据修改

```sql
INSERT INTO course(id, title) VALUES (10, '数据库原理');

UPDATE enrollment
SET score = 90
WHERE student_id = 1 AND course_id = 10;

DELETE FROM enrollment
WHERE student_id = 1 AND course_id = 10;
```

`UPDATE`或`DELETE`遗漏`WHERE`会作用于全部目标行。数据库约束会在数据修改时继续检查实体完整性、参照完整性和用户定义完整性。

## 8. 参数化查询与权限

应用程序不应把外部输入拼进SQL结构。参数化查询把SQL结构和参数值分开，是防止SQL注入的核心机制。详细原理见[SQL注入攻击与防护](../04-信息安全技术基础/04-SQL注入攻击与防护.md)。

数据库账户还应遵循最小权限原则，只授予完成任务所需的表、视图和操作权限。

## 核心关系

```text
DDL定义结构
DML查询和修改数据
DCL控制权限
TCL控制事务

FROM确定数据源 → WHERE筛行 → GROUP BY分组 → HAVING筛组 → SELECT形成结果
```
