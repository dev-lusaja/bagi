# Ingresos Primero: Flujo de Presupuesto Basado en Ingresos Reales

El usuario registra su salario como transacción tipo `INCOME`. El presupuesto global se define como un monto arbitrario sin vínculo a esos ingresos. Este cambio conecta ambos: **los ingresos registrados del mes alimentan la definición del presupuesto global**, y sin ingresos no se puede planificar.

## Decisiones del Usuario

- ✅ **Gate DURO**: Sin ingresos registrados para la cuenta seleccionada, NO se permite definir presupuesto ni inicializar el mes.
- ✅ **Por cuenta**: Cada cuenta es independiente. Si la cuenta A tiene ingresos puede presupuestar; si la cuenta B no tiene, no puede.
- ✅ **Sin mostrar ingresos en Home**: El resumen de cuentas en Home no cambia.

## Proposed Changes

### Onboarding (Home)

#### [MODIFY] [Home.tsx](file:///Users/devlusaja/code/bagi/src/presentation/views/Home.tsx)

- **Agregar paso "Ingresos" al onboarding** (paso 5, antes de "Presupuesto" que pasa a ser paso 6).
- **Condición de completado:** al menos 1 transacción tipo `INCOME` en el mes actual.
- **Acción:** Navegar a Transacciones.

```ts
{ 
  id: 'income', 
  title: 'Ingresos', 
  completed: hasCurrentMonthIncome,
  icon: DollarSign, 
  action: () => onNavigate?.('transactions'), 
  actionLabel: 'Registrar', 
  description: 'Registra tu salario antes de planificar.' 
}
```

---

### Dashboard — Gate de Ingresos por Cuenta

#### [MODIFY] [Dashboard.tsx](file:///Users/devlusaja/code/bagi/src/presentation/views/Dashboard.tsx)

**1. Calcular ingresos del mes para la cuenta seleccionada**

En `fetchDashboardData`, calcular el total de transacciones `INCOME` filtradas por `account_id` de la cuenta actual:

```ts
const incomeForAccount = monthlyTx
  .filter(t => t.account_id === actualId)
  .filter(t => categories.find(c => c.id === t.category_id)?.type === 'INCOME')
  .reduce((sum, t) => sum + t.amount, 0);

setMonthlyIncome(incomeForAccount);
```

Nuevo state: `const [monthlyIncome, setMonthlyIncome] = useState(0);`

**2. Reemplazar el form "Definir Presupuesto Global"**

Cuando NO existe `globalBudget`:

- **Si `monthlyIncome > 0`:** Mostrar desglose de ingresos detectados + botón "Usar como presupuesto" + opción de ajustar manualmente.
- **Si `monthlyIncome === 0`:** Mostrar bloqueo duro: mensaje que indica que debe registrar ingresos primero + botón que navega a Transacciones. **Sin input de monto. Sin botón guardar.** No hay forma de crear el presupuesto global.

**3. Bloquear "Inicializar Mes" sin ingresos**

- Si `monthlyIncome === 0`: el botón "Inicializar Mes" se muestra deshabilitado con tooltip explicativo.
- Si `monthlyIncome > 0` pero no hay `globalBudget`: botón deshabilitado con mensaje "Define tu presupuesto primero".

---

### No se modifica

| Componente | Razón |
|---|---|
| Schema SQLite | Sin tablas ni columnas nuevas |
| IBudgetRepository | Sin métodos nuevos |
| BudgetService | Los datos se calculan en frontend |
| Entidades de dominio | Sin cambios |
| Settings.tsx | Sin cambios |
| Transactions.tsx | Sin cambios |

## Verification Plan

### Manual Verification
1. **Cuenta sin ingresos:** Dashboard → sidebar muestra bloqueo, no permite definir presupuesto ni inicializar.
2. **Registrar INCOME:** ir a Transacciones → registrar salario en cuenta A → volver al Dashboard → sidebar muestra desglose y permite definir presupuesto.
3. **Cuenta B sin ingresos:** cambiar a cuenta B en el dashboard → bloqueo activo, independiente de cuenta A.
4. **Onboarding:** Home muestra paso "Ingresos" correcto según si hay o no INCOME del mes.
