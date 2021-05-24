// Position
// @author      Dominique Da Silva
// @url         https://apps.inspira.io/
// @created     2021-05

import { run, css } from "uebersicht";
import { ResizeSensor } from 'css-element-queries' // http://marcj.github.io/css-element-queries/

const settings = require('./config.json');

class WidgetError extends Error {
    constructor(msg, id) {
        super(msg);
        this.widgetid = id;
    }
}

export const initialState = { type: "INIT", data: "positioning ${Object.keys(settings).length - 1} widgets..."};

export const refreshFrequency = settings?.["@defaults"]?.refreshFrequency ?? 60000

export const className = `
    left: 20px;
    top: 20px;
    color: #FFF;
    font-size: "12px";
`
const errorClass = css({
    background: "rgba(0, 0, 0, 0.8)",
    borderRadius: "8px",
    padding: "8px 10px",
    fontFamily: "monospace",

    "& > b": {
        color: "red"
    }
})

const createMarkup = (msg) => { return { __html: msg } };

export const render = ({ output, error }) => {
    return error ? (
        <div className={errorClass} dangerouslySetInnerHTML={createMarkup(error)}></div>
    ) : (
        <div>{output}</div>
    )
}

export const addUnit = (p) => {
    p = String(p);
    return (p === '' || ['initial', 'px', '%', 'inherit', 'vh', 'vw'].some(el => p.includes(el))) ? p  : p + 'px';
}

export const setPositionFromObj = (widget, position) => {
    let defaults = {
        top: "initial",
        left: "initial",
        right: "initial",
        bottom: "initial"
    }
    Object.assign(defaults, position);
    Object.keys(defaults).forEach((pos) => widget.style[pos] = addUnit(defaults[pos]));
}

export const setPositionFromString = (widget, position) => {
    const p = position.split('|');
    if (p.length === 3) {
        switch(p[0]) {
            case 'TL': setPositionFromObj(widget, { top: p[1], left: p[2] }); break;
            case 'TR': setPositionFromObj(widget, { top: p[1], right: p[2] }); break;
            case 'BL': setPositionFromObj(widget, { bottom: p[1], left: p[2] }); break;
            case 'BR': setPositionFromObj(widget, { bottom: p[1], right: p[2] }); break;
            case 'C':
                const posV = parseInt(p[1]) === 0 ? (window.innerHeight / 2 - widget.offsetHeight / 2) + 'px' : p[1];
                const posH = parseInt(p[2]) === 0 ? (window.innerWidth / 2 - widget.offsetWidth / 2) + 'px' : p[2];
                setPositionFromObj(widget, {top: posV, left: posH});
                break;
            default:
                throw `unknow positional settings ${p[0]}, must be one of: TL, TR, BL, BR, C`;
        }
    } else {
        throw "Position need 3 values separated by an `|`";
    }
}

const position = (widget) => {

    if (typeof settings[widget.id] !== 'object')
        return fail(`Widget definition must be an object`, widget.id);

    const pos = settings[widget.id]['position'];
    const trz = widget.style.transition;

    setTimeout(() => widget.style.opacity = 1.0, 500);
    setTimeout(() => widget.style.transition = trz, 800);

    widget.style.transition = "0.5s";

    const useStyle = (!(settings[widget.id]["@useCss"] ?? false));

    // Apply additional styles
    if (useStyle) {
        if (settings.debug || typeof widget.customstyle === 'undefined') {
            let styles = Object.keys(settings[widget.id]).filter(k => k !== 'position' && k[0] !== '@' && k[0] !== '_'); // excludes position or key begining with @ or _
            if (styles.length > 0) {
                styles.forEach((s) => widget.style[s] = settings[widget.id][s])
            }
            widget.customstyle = true;
        }
    } else if (settings.debug || typeof widget.customcss === 'undefined') {
        if (widget.customcss) { widget.classList.remove(widget.customcss) }
        const filteredStyles = Object.entries(settings[widget.id]).filter(([k, _]) => (k !== 'position' && k[0] !== '@' && k[0] !== '_'));
        const styles = Object.fromEntries(filteredStyles);

        widget.customcss = css(styles);
        widget.classList.add(widget.customcss);
    }

    // Apply widget position
    try {
        if (typeof pos === 'string') {
            setPositionFromString(widget, pos);
        } else if (typeof pos === 'object') {
            setPositionFromObj(widget, pos);
        } else {
            throw 'Widget position must be an object or a string';
        }
    } catch (error) {
        throw new WidgetError(error, widget.id);
    }

}

const positionAll = () => {
    for (let widget of document.body.getElementsByClassName('widget')) {
        if (!(widget.id in settings))
            continue;
        position(widget)
        if (typeof widget.sensor === 'undefined')
            attachSensor(widget);
    }
}

const debounce = (func, wait, immediate) => {
    var timeout;
    return function () {
        var context = this, args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

const attachSensor = (widget) => {
    widget.reposition = debounce(() => {
        position(widget);
    }, 1000);

    widget.sensor = new ResizeSensor(widget, (size) => {
        widget.reposition()
    })
}

const fail = (error) => {
    return { error: `<b>${error?.widgetid ?? "widget"}</b>: ${error.message}` }
}

export const init = () => {
    for (let widget of document.body.getElementsByClassName('widget')) {
        if (!(widget.id in settings))
            continue;
        widget.style.opacity = 0.0;
        attachSensor(widget);
    }
}

export const command = (dispatch) => {
    return run('sleep 1').then(() => dispatch({ type: "RUN", data: '' }))
}

export const updateState = (event, previousState) => {
    if (event.type === "RUN") {
        try {
            positionAll()
        } catch (e) {
            return fail(e);
        }
        return {output: event.data};
    }
    return previousState;
}
