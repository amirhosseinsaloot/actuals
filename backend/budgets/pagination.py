"""Shared pagination for list endpoints.

Page-number pagination with a client-tunable, capped page size. Responses use
the standard DRF envelope: ``{count, next, previous, results}``.
"""

from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100
