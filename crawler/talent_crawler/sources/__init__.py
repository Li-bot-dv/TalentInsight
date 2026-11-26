"""Source adapter registry."""

from .ats_and_news import CompanyATSAdapter, VietnamNewsRSSAdapter
from .vn_boards import CareerVietAdapter, ITviecAdapter, TopDevAdapter, VietnamWorksAdapter

SOURCE_REGISTRY = {
    "topdev": TopDevAdapter,
    "itviec": ITviecAdapter,
    "vietnamworks": VietnamWorksAdapter,
    "careerviet": CareerVietAdapter,
    "company_ats": CompanyATSAdapter,
    "vn_news_rss": VietnamNewsRSSAdapter,
}
