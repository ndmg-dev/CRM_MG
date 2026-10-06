from enum import Enum


class HoursFormat(str, Enum):
    HOURS_MINUTES = "HOURS_MINUTES"
    DECIMAL_HOURS = "DECIMAL_HOURS"


class PayrollEventType(str, Enum):
    OVERTIME_50 = "OVERTIME_50"
    OVERTIME_100 = "OVERTIME_100"
    PARTIAL_ABSENCE = "PARTIAL_ABSENCE"
    FULL_ABSENCE = "FULL_ABSENCE"
    NIGHT_ADDITIONAL = "NIGHT_ADDITIONAL"
    DSR = "DSR"
    COMMISSION = "COMMISSION"
    OTHER = "OTHER"


class PayslipItemUnit(str, Enum):
    HOURS = "HOURS"
    DAYS = "DAYS"
    VALUE = "VALUE"
    PERCENTAGE = "PERCENTAGE"


class OperationType(str, Enum):
    INSERT = "INSERT"
    DELETE = "DELETE"


class DominioExportStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATING = "VALIDATING"
    READY = "READY"
    SENDING = "SENDING"
    PARTIAL = "PARTIAL"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class DominioExportItemStatus(str, Enum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
