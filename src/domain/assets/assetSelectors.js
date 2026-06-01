export const fixedAssetSummary = (state) => {
  const totalCost = state.fixedAssets.reduce((sum, asset) => sum + Number(asset.cost || 0), 0);
  const byStatus = state.fixedAssets.reduce((acc, asset) => {
    acc[asset.status] = (acc[asset.status] || 0) + 1;
    return acc;
  }, {});
  const byCategory = state.fixedAssets.reduce((acc, asset) => {
    acc[asset.category] ||= [];
    acc[asset.category].push(asset);
    return acc;
  }, {});
  return {
    total: state.fixedAssets.length,
    totalCost,
    byStatus,
    byCategory,
  };
};

export const crateAssetSummary = (state) => {
  const loaned = state.crateLoans.filter((loan) => loan.status === 'Prestado');
  const lost = state.crateLoans.filter((loan) => loan.status === 'No Devuelto');
  const owned = state.crateInventory.reduce((sum, item) => sum + Number(item.quantityOwned || 0), 0);
  const loanedQty = loaned.reduce((sum, loan) => sum + Number(loan.quantity || 0), 0);
  const lostQty = lost.reduce((sum, loan) => sum + Number(loan.quantity || 0), 0);
  const totalValue = state.crateInventory.reduce((sum, item) => {
    const type = state.crateTypes.find((crateType) => crateType.id === item.crateTypeId);
    return sum + Number(item.quantityOwned || 0) * Number(type?.cost || 0);
  }, 0);
  return {
    owned,
    loaned: loanedQty,
    lost: lostQty,
    inStock: Math.max(0, owned - loanedQty),
    totalValue,
  };
};
