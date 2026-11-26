"""Source adapter registry."""

from .ats_and_news import CompanyATSAdapter, VietnamNewsRSSAdapter
from .vn_boards import CareerLinkAdapter, CareerVietAdapter, ITviecAdapter, TopDevAdapter, VietnamWorksAdapter

SOURCE_REGISTRY = {
    "company_ats": CompanyATSAdapter,
    "topdev": TopDevAdapter,
    "vietnamworks": VietnamWorksAdapter,
    "careerviet": CareerVietAdapter,
    "careerlink": CareerLinkAdapter,
    "itviec": ITviecAdapter,
    "vn_news_rss": VietnamNewsRSSAdapter,
}
