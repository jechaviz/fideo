import React from 'react';

const SVG_ALLOWED_TAGS = new Set([
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'title',
    'desc',
    'defs',
    'lineargradient',
    'radialgradient',
    'stop',
    'mask',
    'clippath',
]);

const SVG_ALLOWED_ATTRIBUTES = new Set([
    'aria-hidden',
    'clip-path',
    'clip-rule',
    'cx',
    'cy',
    'd',
    'dominant-baseline',
    'fill',
    'fill-opacity',
    'fill-rule',
    'focusable',
    'font-size',
    'gradientTransform',
    'gradientUnits',
    'height',
    'id',
    'mask',
    'offset',
    'opacity',
    'points',
    'r',
    'role',
    'rx',
    'ry',
    'stop-color',
    'stop-opacity',
    'stroke',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-opacity',
    'stroke-width',
    'text-anchor',
    'transform',
    'viewBox',
    'width',
    'x',
    'x1',
    'x2',
    'xmlns',
    'y',
    'y1',
    'y2',
]);

const isSafeSvgAttributeValue = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (/javascript:|data:|vbscript:/.test(normalized)) return false;
    if (normalized.includes('url(') && !/url\(\s*#[a-z0-9_-]+\s*\)/i.test(normalized)) return false;
    return true;
};

export const sanitizeSvgMarkup = (value: string): string => {
    const source = value.trim();
    if (!source.startsWith('<svg') || typeof window === 'undefined') return '';

    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (document.querySelector('parsererror')) return '';

    const root = document.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg') return '';

    const sanitizeNode = (node: Element) => {
        if (!SVG_ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
            node.remove();
            return;
        }

        Array.from(node.attributes).forEach((attribute) => {
            const name = attribute.name;
            if (
                name.toLowerCase().startsWith('on')
                || !SVG_ALLOWED_ATTRIBUTES.has(name)
                || !isSafeSvgAttributeValue(attribute.value)
            ) {
                node.removeAttribute(name);
            }
        });

        Array.from(node.children).forEach((child) => sanitizeNode(child));
    };

    sanitizeNode(root);
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(root);
};

const renderInlineMarkdown = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`${keyPrefix}-strong-${index}`}>{part.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
    });
};

export const SafeMarkdown: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
    const blocks: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = (key: string) => {
        if (!listItems.length) return;
        const items = listItems;
        listItems = [];
        blocks.push(
            <ul key={key} className="my-3 list-disc space-y-2 pl-5">
                {items.map((item, index) => (
                    <li key={`${key}-item-${index}`}>{renderInlineMarkdown(item, `${key}-item-${index}`)}</li>
                ))}
            </ul>,
        );
    };

    text.split(/\r?\n/).forEach((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) {
            flushList(`list-${index}`);
            return;
        }

        const listMatch = line.match(/^[-*]\s+(.+)$/);
        if (listMatch) {
            listItems.push(listMatch[1]);
            return;
        }

        flushList(`list-${index}`);

        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            const Heading = headingMatch[1].length === 1 ? 'h2' : 'h3';
            blocks.push(
                <Heading key={`heading-${index}`} className="mt-5 text-base font-black text-white first:mt-0">
                    {renderInlineMarkdown(headingMatch[2], `heading-${index}`)}
                </Heading>,
            );
            return;
        }

        blocks.push(
            <p key={`paragraph-${index}`} className="my-3 leading-7 first:mt-0 last:mb-0">
                {renderInlineMarkdown(line, `paragraph-${index}`)}
            </p>,
        );
    });

    flushList('list-final');

    return <div className={className}>{blocks}</div>;
};
