from django.contrib import admin

from .models import AssistantRun, BudgetLineItem, BudgetScenario


class BudgetLineItemInline(admin.TabularInline):
    model = BudgetLineItem
    extra = 0


@admin.register(BudgetScenario)
class BudgetScenarioAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "period_start", "period_end", "currency")
    inlines = [BudgetLineItemInline]


@admin.register(BudgetLineItem)
class BudgetLineItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scenario",
        "department",
        "category",
        "budget_amount",
        "actual_amount",
    )
    list_filter = ("scenario", "department", "category")
    # ``scenario`` is shown in list_display; JOIN it in so the changelist does
    # not issue one extra query per row to render it.
    list_select_related = ("scenario",)


@admin.register(AssistantRun)
class AssistantRunAdmin(admin.ModelAdmin):
    list_display = ("id", "scenario", "status", "created_at")
    list_filter = ("status",)
    list_select_related = ("scenario",)
