/**
 *  impl.limits.js - your one stop shop to stop bad input.
 *    If your goal is to add new types of validations, or to modify the ones that
 *    already exist, you're in the right spot. If you wish to fix a bug in how
 *    validations are triggered or recomputed, you'll want to look at validation.js.
 *
 *    Validations may only currently be attached to specific properties of specific
 *    control types. This is done via the configuration section at the bottom of
 *    control.js; any property may define a limits array in which string keys
 *    reference predefined limits in this file, or an ad-hoc definition may be given
 *    following the same syntax as the definitions here.
 *
 *    Here is that syntax:
 *
 *    given
 *    =====
 *    Each validation may declare an interest in any number of dependencies from
 *    anywhere in the control tree. These declarations come in two parts; a scope
 *    and a type.
 *      scope: the control or controls in the form you are interested in. passed
 *        as the scope key of the object passed to given. options:
 *        * all: all controls, anywhere in the form. **n.b. includes self!**
 *        * children: direct children of the validation target control.
 *        * siblings: all siblings of the validation target control.
 *        * parents: all parents of the validation target control.
 *        * self: the validation target control itself; this is given as a bare
 *          value rather than an array.
 *      type: the portion of the selected controls you're interested in. options:
 *        * { property: 'someproperty' }: the given property off selected controls.
 *          If you pass { property: 'self' }, the validation target property is given.
 *        * { type: 'type' }: the control type for each control; eg group or number.
 *        * { type: 'control' }: the entire control.
 *
 *    You'll also notice that often rather than an object, simply the string 'self'
 *    is passed. This is just a shortcut for { scope: 'self', property: 'self' }.
 *
 *    then
 *    ====
 *    The then function takes in all the values gathered by the declared givens,
 *    and uses them to determine whether the validation fails or not. A return value
 *    of true indicates that the validation has found a problem. So as an example,
 *    if for some reason you want the total number of text controls on a form to
 *    equal the value of a given property, you might have:
 *    {
 *        given: [ 'self', { scope: 'all', type: 'type' } ],
 *        then: function(count, types)
 *        {
 *            var texts = _.filter(types, function(type) { return type === 'text' });
 *            return count !== texts.length;
 *        }
 *    }
 *
 *    As you can see, we declare the two parameters that we then take in to process.
 *    Note that validations are very frequently reprocessed, so very heavy operations
 *    may lead to performance difficulties.
 *
 *    prereq (optional)
 *    =================
 *    Prereq is exactly the same as then: it takes the same parameters and also returns
 *    true or false. But if it returns anything other than true, the entire validation
 *    is considered passing and the then clause is never run. This is to cover cases
 *    where, for instance, the then clause tests the /validity/ of a string, but in order
 *    to do so such a string must exist in the first place, and to do so in a way that
 *    doesn't boggle the mind with negative logic within the test itself.
 *
 *    message
 *    =======
 *    The message is the displayed error if the validation finds a problem. Right
 *    now it only takes static strings; eventually it may take a function to
 *    generate a string.
 */

;(function()
{
    var validationNS = odkmaker.namespace.load('odkmaker.validation');

    // some util funcs:
    var hasString = function(val) { return (val != null) && (val !== ''); };
    var hasOptions = function(val) { return _.isArray(val) && (val.length > 0); };
    var xmlLegalChars = function(val) { return /^[0-9a-z_.-]+$/i.test(val); };
    var alphaStart = function(val) { return /^[a-z]/i.test(val); };

    // the actual definitions:
    validationNS.limits = {
        required: {
            given: [ 'self' ],
            then: function(self) { return hasString(self); },
            message: 'This property is required.'
        },
        xmlLegalChars: {
            given: [ 'self' ],
            prereq: hasString,
            then: function(self) { return xmlLegalChars(self); },
            message: 'Only letters, numbers, -, _, and . are allowed.'
        },
        alphaStart: {
            given: [ 'self' ],
            prereq: hasString,
            then: function(self) { return alphaStart(self); },
            message: 'The first character must be a letter.'
        },
        unique: {
            given: [ 'self', { scope: 'all', property: 'self' } ],
            prereq: hasString,
            then: function(self, all)
            {
                // we expect to see one instance of self in all, which is the
                // very instance we are validating. and zero is fine; dragging
                // can cause that. but if we see two or more we're in trouble.
                return _.filter(all, function(it) { return self === it; }).length <= 1;
            },
            message: 'This property must be unique; there is another control that conflicts with it.'
        },
        fieldListChildren: {
            given: [ { scope: 'self', property: 'fieldList' }, { scope: 'children', get: 'type' } ],
            prereq: function(fieldList) { return fieldList === true; },
            then: function(fieldList, childTypes)
            {
                return !_.any(childTypes, function(type) { return type === 'group' || type === 'loop'; });
            },
            message: 'A group may not be Display On One Screen if it has groups or loops within it.'
        },
        underlyingRequired: {
            given: [ 'self' ],
            prereq: _.isArray,
            then: function(options)
            {
                return _.all(options, function(option) { return hasString(option.val); });
            },
            message: 'One or more Underlying Value has not been provided; they are required.'
        },
        underlyingLegalChars: {
            given: [ 'self' ],
            prereq: hasOptions,
            then: function(options)
            {
                return _.all(options, function(option) { return xmlLegalChars(option.val); });
            },
            message: 'One or more Underlying Value contains invalid characters: only letters, numbers, -, _, and . are allowed.'
        },
        underlyingLength: {
            given: [ 'self' ],
            prereq: hasOptions,
            then: function(options)
            {
                return _.all(options, function(option) { return !hasString(option.val) || option.val.length <= 32; });
            },
            message: 'One or more Underlying Value is longer than the allowed maximum of 32 characters.'
        },
        hasOptions: {
            given: [ 'self' ],
            prereq: _.isArray,
            then: function(options)
            {
                return options.length > 0;
            },
            message: 'At least one option is required.'
        },
        fieldListExpr: {
            given: [ 'self', { scope: 'parents', property: 'fieldList' } ],
            prereq: hasString,
            then: function(expr, parentFLs)
            {
                return _.all(parentFLs, function(fl) { return fl !== true; });
            },
            severity: 'warning',
            message: 'Because this control is within a single-screen group (field list), any expressions that reference other fields in the same group will not work.'
        }
    };

})();

