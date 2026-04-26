
import React from 'react';

const I = ({ className }: { className: string }) => <i className={`fa-solid ${className}`}></i>;

export const DashboardIcon = () => <I className="fa-fw fa-grip" />;
export const MessageIcon = () => <I className="fa-fw fa-comments" />;
export const InventoryIcon = () => <I className="fa-fw fa-boxes-stacked" />;
export const HistoryIcon = () => <I className="fa-fw fa-clock-rotate-left" />;
export const TrainingIcon = () => <I className="fa-fw fa-brain" />;
export const SalesLogIcon = () => <I className="fa-fw fa-file-invoice-dollar" />;
export const CustomersIcon = () => <I className="fa-fw fa-users" />;
export const SettingsIcon = () => <I className="fa-fw fa-gear" />;
export const DeliveriesIcon = () => <I className="fa-fw fa-truck" />;
export const AssetsIcon = () => <I className="fa-fw fa-building-columns" />;
export const FinanceIcon = () => <I className="fa-fw fa-sack-dollar" />;
export const PromotionsIcon = () => <I className="fa-fw fa-bullhorn" />;
export const RipeningIcon = () => <I className="fa-fw fa-forward" />;
export const SuppliersIcon = () => <I className="fa-fw fa-truck-field" />;
export const ActionCenterIcon = () => <I className="fa-fw fa-clipboard-check" />;
export const PlanogramIcon = () => <I className="fa-fw fa-cubes-stacked" />;

export const ArchiveBoxIcon = () => <I className="fa-snowflake" />;
export const CubeTransparentIcon = () => <I className="fa-hourglass-half" />;
export const FireIcon = () => <I className="fa-trash-can" />;
export const BuildingStorefrontIcon = () => <I className="fa-store" />;

export const ChevronDownIcon = () => <I className="fa-chevron-down" />;
export const ChevronRightIcon = () => <I className="fa-chevron-right" />;
export const ChevronLeftIcon = () => <I className="fa-chevron-left" />;
export const EditIcon = () => <I className="fa-pencil text-xs" />;
export const MoveIcon = () => <I className="fa-fw fa-right-left text-xs" />;
export const ChevronUpIcon = () => <I className="fa-chevron-up" />;
export const CheckIcon = () => <I className="fa-check" />;
export const SunIcon = () => <I className="fa-sun" />;
export const MoonIcon = () => <I className="fa-moon" />;
export const TagIcon = () => <I className="fa-tag text-xs" />;
export const ListIcon = () => <I className="fa-list" />;
export const GridIcon = () => <I className="fa-border-all" />;


export const SaleIcon = () => <I className="fa-hand-holding-dollar text-green-600 dark:text-green-400" />;
export const PriceIcon = () => <I className="fa-tag text-blue-600 dark:text-blue-400" />;
export const StateChangeIcon = () => <I className="fa-arrow-right-arrow-left text-purple-600 dark:text-purple-400" />;
export const CrateLoanIcon = () => <I className="fa-box-open text-yellow-600 dark:text-yellow-400" />;
export const EmployeeIcon = () => <I className="fa-user text-indigo-600 dark:text-indigo-400" />;
export const MicrophoneIcon = () => <I className="fa-microphone text-xl" />;
export const WarehouseTransferIcon = () => <I className="fa-right-left text-cyan-600 dark:text-cyan-400" />;
export const AssignmentIcon = () => <I className="fa-user-check text-sky-600 dark:text-sky-400" />;
export const CheckCircleIcon = () => <I className="fa-circle-check text-teal-600 dark:text-teal-400" />;
export const AdjustmentIcon = () => <I className="fa-wrench text-gray-600 dark:text-gray-400" />;
export const ProductCrudIcon = () => <I className="fa-apple-whole text-pink-600 dark:text-pink-400"/>;
export const ExpenseIcon = () => <I className="fa-money-bill-transfer text-red-600 dark:text-red-400" />;
export const NavigateIcon = () => <I className="fa-compass text-fuchsia-600 dark:text-fuchsia-400" />;
export const FilterIcon = () => <I className="fa-filter text-rose-600 dark:text-rose-400" />;
export const MermaIcon = () => <I className="fa-trash text-red-600 dark:text-red-400" />;
export const WarehouseIcon = () => <I className="fa-building text-orange-600 dark:text-orange-400" />;
export const OfferIcon = () => <I className="fa-bullhorn text-lime-600 dark:text-lime-400" />;
export const PurchaseOrderIcon = () => <I className="fa-fw fa-cart-plus text-teal-600 dark:text-teal-400" />;
export const SupplierCrudIcon = () => <I className="fa-fw fa-address-book text-indigo-600 dark:text-indigo-400" />;
export const PaymentIcon = () => <I className="fa-fw fa-money-bill-wave text-emerald-600 dark:text-emerald-400" />;
export const AssetSaleIcon = () => <I className="fa-truck-ramp-box text-orange-600 dark:text-orange-400" />;
export const CashIcon = () => <I className="fa-fw fa-money-bill-1-wave" />;


export const PlusIcon = () => <I className="fa-plus" />;
export const ArchiveBoxXMarkIcon = () => <I className="fa-box-archive" />;
export const ArrowUturnLeftIcon = () => <I className="fa-arrow-rotate-left" />;
export const SparklesIcon = () => <I className="fa-wand-magic-sparkles" />;
export const Bars3Icon = () => <I className="fa-bars" />;
export const XMarkIcon = () => <I className="fa-xmark" />;


export const BotIcon = () => (
    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white">
        <I className="fa-bolt-lightning" />
    </div>
);

export const UserIcon = () => (
    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200">
        <I className="fa-user" />
    </div>
);